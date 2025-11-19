/**
 * SSC API Client
 *
 * Axios-based wrapper for Fortify Software Security Center API.
 * Based on validated patterns from Phase 1 Python scripts.
 *
 * CRITICAL NOTES:
 * - No global /issues endpoint exists - use /projectVersions/{id}/issues
 * - Cannot use q=removed:false modifier - filter in application code
 * - Cannot use groupby parameter - group in application code
 * - Use fields parameter to limit payload size
 */

const axios = require('axios');
const sscConfig = require('../config/ssc-config');
const logger = require('./logger');

class SSCApiClient {
  constructor(config = sscConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.timeout = config.timeout;
    this.retries = config.retries;
    this.retryDelay = config.retryDelay;

    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Authorization': `FortifyToken ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('SSC API Request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('SSC API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('SSC API Response', {
          url: response.config.url,
          status: response.status,
          dataCount: response.data?.data?.length || 'N/A'
        });
        return response;
      },
      (error) => {
        logger.error('SSC API Response Error', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make a GET request to SSC API with retry logic
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {object} params - Query parameters
   * @param {number} attempt - Current retry attempt (internal)
   * @returns {Promise<object>} - API response data
   */
  async get(endpoint, params = {}, attempt = 1) {
    try {
      const response = await this.client.get(endpoint, { params });
      return response.data;
    } catch (error) {
      // Retry logic
      if (attempt < this.retries && this.shouldRetry(error)) {
        const delay = this.retryDelay * attempt;
        logger.warn(`Retrying SSC API request (attempt ${attempt + 1}/${this.retries})`, {
          endpoint,
          delay
        });
        await this.sleep(delay);
        return this.get(endpoint, params, attempt + 1);
      }

      // Classify and throw error
      throw this.classifyError(error, endpoint);
    }
  }

  /**
   * Test connection to SSC API
   * @returns {Promise<object>} - Connection status
   */
  async testConnection() {
    try {
      logger.info('Testing SSC API connection');
      const response = await this.get('/projects', { limit: 1 });
      logger.info('SSC API connection successful');
      return {
        connected: true,
        version: sscConfig.version,
        baseUrl: this.baseUrl
      };
    } catch (error) {
      logger.error('SSC API connection failed', { error: error.message });
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get all projects with optional filters
   * @param {object} filters - Filter parameters
   * @returns {Promise<Array>} - List of projects
   */
  async getAllProjects(filters = {}) {
    const params = { limit: sscConfig.defaultPageSize, ...filters };
    const response = await this.get('/projects', params);
    return response.data || [];
  }

  /**
   * Get all project versions with optional filters
   * @param {object} filters - Filter parameters
   * @returns {Promise<Array>} - List of project versions
   */
  async getAllVersions(filters = {}) {
    const params = { limit: sscConfig.defaultPageSize, ...filters };
    const response = await this.get('/projectVersions', params);
    return response.data || [];
  }

  /**
   * Get issues for a specific project version
   * @param {number} versionId - Project version ID
   * @param {string} fields - Comma-separated list of fields to return
   * @returns {Promise<Array>} - List of issues
   */
  async getVersionIssues(versionId, fields = 'severity,removed,scanStatus,foundDate') {
    const params = {
      limit: sscConfig.maxPageSize,
      fields
    };
    const response = await this.get(`/projectVersions/${versionId}/issues`, params);
    return response.data || [];
  }

  /**
   * Get all pages of data from a paginated endpoint
   * @param {string} endpoint - API endpoint
   * @param {object} params - Query parameters
   * @returns {Promise<Array>} - All data from all pages
   */
  async getWithPagination(endpoint, params = {}) {
    const allData = [];
    let start = 0;
    const limit = params.limit || sscConfig.defaultPageSize;

    while (true) {
      const response = await this.get(endpoint, { ...params, start, limit });
      const data = response.data || [];

      if (data.length === 0) break;

      allData.push(...data);

      // Check if we've reached the end
      if (data.length < limit || (response.count && allData.length >= response.count)) {
        break;
      }

      start += limit;
    }

    logger.debug('Pagination complete', {
      endpoint,
      totalItems: allData.length
    });

    return allData;
  }

  /**
   * Determine if an error should trigger a retry
   * @param {Error} error - Error object
   * @returns {boolean} - True if should retry
   */
  shouldRetry(error) {
    // Retry on network errors or 5xx server errors
    if (!error.response) return true; // Network error
    const status = error.response.status;
    return status >= 500 && status < 600;
  }

  /**
   * Classify error for better error handling
   * @param {Error} error - Error object
   * @param {string} endpoint - API endpoint
   * @returns {Error} - Classified error
   */
  classifyError(error, endpoint) {
    if (!error.response) {
      const err = new Error(`Network error connecting to SSC API: ${error.message}`);
      err.type = 'NETWORK_ERROR';
      err.statusCode = 503;
      return err;
    }

    const status = error.response.status;
    const message = error.response.data?.message || error.message;

    if (status === 401) {
      const err = new Error('SSC API authentication failed - invalid token');
      err.type = 'AUTH_ERROR';
      err.statusCode = 401;
      return err;
    }

    if (status === 403) {
      const err = new Error('SSC API access forbidden - insufficient permissions');
      err.type = 'PERMISSION_ERROR';
      err.statusCode = 403;
      return err;
    }

    if (status === 404) {
      const err = new Error(`SSC API endpoint not found: ${endpoint}`);
      err.type = 'NOT_FOUND';
      err.statusCode = 404;
      return err;
    }

    if (status === 400) {
      const err = new Error(`SSC API bad request: ${message}`);
      err.type = 'BAD_REQUEST';
      err.statusCode = 400;
      return err;
    }

    const err = new Error(`SSC API error (${status}): ${message}`);
    err.type = 'API_ERROR';
    err.statusCode = status;
    return err;
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new SSCApiClient();
