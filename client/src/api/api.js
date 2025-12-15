import axios from "axios";
import { handleApiError, createAbortController, isCancelledError } from "../utils/errorHandler";

// Get API base URL from environment, with fallback for local development
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const DEFAULT_LIMIT = 100;
const DEFAULT_TIME_FILTER = "month";
const REQUEST_TIMEOUT = 300000; // 5 minutes for long-running operations

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true,
});

// Log API base URL in development to help debug
if (import.meta.env.DEV) {
  console.log("API Base URL:", API_BASE);
}

/**
 * Discover insights for a topic with AI-powered suggestions
 * @param {{
 *   topic: string,
 *   limit?: number,
 *   time_filter?: string
 * }} options
 */
export const triggerScrape = async (options) => {
  const {
    topic,
    limit = DEFAULT_LIMIT,
    time_filter = DEFAULT_TIME_FILTER,
    is_custom = false,
  } = options;

  if (!topic || !topic.trim()) {
    throw new Error("Topic is required");
  }

  const payload = {
    topic: topic.trim(),
    limit,
    time_filter,
    is_custom,
  };

  try {
    const abortController = createAbortController();
    const res = await apiClient.post('/scrape', payload, {
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    const errorInfo = handleApiError(err);
    throw new Error(errorInfo.message);
  }
};

/**
 * Get all discovered insights/posts
 * @param {Object} filters - All optional query filters
 * @returns {Promise<Object>}
 */
export const fetchPosts = async (filters = {}) => {
  try {
    const abortController = createAbortController();
    const res = await axios.get(`${API_BASE}/posts`, {
      params: filters,
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to fetch posts");
    }
    throw err;
  }
};

/**
 * Register a new user
 * @param {{
 *   username: string,
 *   password: string,
 *   email?: string
 * }} userData
 */
export const registerUser = async (userData) => {
  try {
    const abortController = createAbortController();
    const res = await axios.post(`${API_BASE}/register`, userData, {
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    // Return error response data if available, otherwise throw
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Registration failed");
    }
    throw err;
  }
};

/**
 * Login to the application
 * @param {{
 *   username: string,
 *   password: string
 * }} credentials
 */
export const loginUser = async (credentials) => {
  try {
    const res = await axios.post(`${API_BASE}/login`, credentials, {
      withCredentials: true, // Important for cookies to be received
    });
    return res.data;
  } catch (err) {
    // Return error response data if available, otherwise throw
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Login failed");
    }
    throw err;
  }
};

/**
 * Logout and clear credentials
 * @returns {Promise<Object>}
 */
export const logoutUser = async () => {
  try {
    const res = await axios.post(
      `${API_BASE}/logout`,
      {},
      {
        withCredentials: true, // Important for cookies to be sent
      }
    );
    return res.data;
  } catch (err) {
    // Even if logout fails on server, we should still clear local state
    // Return error response data if available, otherwise throw
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Logout failed");
    }
    throw err;
  }
};

/**
 * Get saved recommendations without generating new ones
 * @param {{
 *   products?: string[]
 * }} options
 */
export const fetchSavedRecommendations = async ({ products }) => {
  try {
    const abortController = createAbortController();
    let params = {};
    if (Array.isArray(products) && products.length > 0) {
      // Convert array to products[] format for query params
      products.forEach((product) => {
        params["products[]"] = params["products[]"] || [];
        params["products[]"].push(product);
      });
    }

    const res = await axios.get(`${API_BASE}/recommendations`, {
      params: params,
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to fetch recommendations");
    }
    throw err;
  }
};

/**
 * Generate new recommendations using OpenAI
 * @param {{
 *   products?: string[]
 * }} options
 */
export const generateRecommendations = async ({ products }) => {
  try {
    const abortController = createAbortController();
    const requestData = {
      products: Array.isArray(products) ? products : [],
    };

    const res = await axios.post(`${API_BASE}/recommendations`, requestData, {
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to generate recommendations");
    }
    throw err;
  }
};

/**
 * Get pain points for a product
 * @param {Object} filters
 * @param {string} [filters.product]
 * @param {number} [filters.limit]
 * @param {number} [filters.min_severity]
 */
export const fetchPainPoints = async (filters = {}) => {
  try {
    const abortController = createAbortController();
    const res = await axios.get(`${API_BASE}/pain-points`, {
      params: filters,
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to fetch pain points");
    }
    throw err;
  }
};

/**
 * Get Claude-generated analysis of pain points
 * @param {{
 *   products?: string[]
 * }} options
 */
export const fetchClaudeAnalysis = async ({ product }) => {
  try {
    const abortController = createAbortController();
    const res = await axios.get(`${API_BASE}/claude-analysis`, {
      params: { products: product },
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to fetch Claude analysis");
    }
    throw err;
  }
};

// Alias for backward compatibility
export const fetchOpenAIAnalysis = fetchClaudeAnalysis;

/**
 * Get list of all products that have posts (whether analyzed or not)
 */
export const fetchAllProducts = async () => {
  try {
    const abortController = createAbortController();
    const res = await axios.get(`${API_BASE}/all-products`, {
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to fetch all products");
    }
    throw err;
  }
};

/**
 * Run OpenAI analysis for a specific product
 * @param {{ product: string }} options
 */
export const runAnalysis = async ({ product }) => {
  try {
    const res = await axios.post(
      `${API_BASE}/run-analysis`,
      { product },
      {
        withCredentials: true,
      }
    );
    return res.data;
  } catch (err) {
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to run analysis");
    }
    throw err;
  }
};

/**
 * Get status/connection info
 */
export const fetchStatus = async () => {
  try {
    const abortController = createAbortController();
    const res = await axios.get(`${API_BASE}/status`, {
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    // Don't throw for 401/403 - let AuthContext handle it
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw err;
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to fetch status");
    }
    throw err;
  }
};

/**
 * Get current user's profile information including credits
 */
export const fetchUserProfile = async () => {
  try {
    const abortController = createAbortController();
    const res = await axios.get(`${API_BASE}/user/profile`, {
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to fetch user profile");
    }
    throw err;
  }
};

/**
 * Update user credits
 * @param {{
 *   username: string,
 *   credits: number,
 *   operation: 'set' | 'add' | 'deduct'
 * }} options
 */
export const updateUserCredits = async (options) => {
  try {
    const abortController = createAbortController();
    const res = await axios.post(`${API_BASE}/user/credits`, options, {
      signal: abortController.signal,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      throw new Error(err.response.data.message || "Failed to update credits");
    }
    throw err;
  }
};

/**
 * Delete user account
 * @returns {Promise<Object>}
 */
export const deleteAccount = async () => {
  try {
    const abortController = createAbortController();
    const res = await apiClient.delete('/user', {
      signal: abortController.signal,
      withCredentials: true,
    });
    return res.data;
  } catch (err) {
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    const errorInfo = handleApiError(err);
    throw new Error(errorInfo.message || "Failed to delete account");
  }
};
