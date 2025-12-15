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
      withCredentials: true, // Important for cookies to be sent
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
  console.log('[API] ========== LOGIN USER API CALL ==========');
  console.log('[API] Username:', credentials.username);
  console.log('[API] Has password:', !!credentials.password);
  console.log('[API] API Base URL:', API_BASE);
  console.log('[API] Login endpoint:', `${API_BASE}/login`);
  console.log('[API] Cookies before request:', document.cookie || 'No cookies found');
  
  try {
    console.log('[API] Step 1: Sending POST request to login endpoint...');
    console.log('[API] Request config:', {
      url: `${API_BASE}/login`,
      method: 'POST',
      withCredentials: true,
      hasCredentials: !!credentials
    });
    
    const res = await axios.post(`${API_BASE}/login`, credentials, {
      withCredentials: true, // Important for cookies to be received
    });
    
    console.log('[API] Step 2: Login response received');
    console.log('[API] Response status:', res.status, res.statusText);
    console.log('[API] Response headers:', {
      'set-cookie': res.headers['set-cookie'] ? 'Present (cookies should be set)' : 'Not present',
      'content-type': res.headers['content-type']
    });
    console.log('[API] Response data:', { 
      status: res.data?.status,
      message: res.data?.message,
      hasUser: !!res.data?.user,
      username: res.data?.user?.username
    });
    
    // Note: httpOnly cookies won't appear in document.cookie
    console.log('[API] Step 3: Checking cookies after response (httpOnly cookies not visible):', document.cookie || 'No cookies found');
    console.log('[API] Note: httpOnly cookies are set by the browser and sent automatically with subsequent requests');
    console.log('[API] ========== LOGIN USER API SUCCESS ==========');
    
    return res.data;
  } catch (err) {
    console.error('[API] ========== LOGIN USER API ERROR ==========');
    console.error('[API] Error type:', err.constructor.name);
    console.error('[API] Error message:', err.message);
    console.error('[API] Error details:', {
      message: err.message,
      responseStatus: err.response?.status,
      responseStatusText: err.response?.statusText,
      responseData: err.response?.data,
      hasResponse: !!err.response,
      requestUrl: err.config?.url,
      requestMethod: err.config?.method
    });
    
    if (err.response) {
      console.error('[API] Response headers:', err.response.headers);
      console.error('[API] Response data:', err.response.data);
    }
    
    console.error('[API] ========== LOGIN USER API ERROR END ==========');
    
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
  console.log('[API] ========== FETCH ALL PRODUCTS API CALL ==========');
  console.log('[API] API Base URL:', API_BASE);
  console.log('[API] Products endpoint:', `${API_BASE}/all-products`);
  console.log('[API] Cookies (httpOnly not visible):', document.cookie || 'No cookies found');
  console.log('[API] Note: httpOnly cookies are sent automatically with withCredentials: true');
  
  try {
    const abortController = createAbortController();
    console.log('[API] Step 1: Sending GET request to all-products endpoint...');
    console.log('[API] Request config:', {
      url: `${API_BASE}/all-products`,
      method: 'GET',
      withCredentials: true,
      hasSignal: !!abortController.signal
    });
    
    const res = await axios.get(`${API_BASE}/all-products`, {
      signal: abortController.signal,
      withCredentials: true, // Important for cookies to be sent
    });
    
    console.log('[API] Step 2: Products response received');
    console.log('[API] Response status:', res.status, res.statusText);
    console.log('[API] Response data:', { 
      status: res.data?.status,
      productsCount: res.data?.products?.length || 0,
      products: res.data?.products?.map(p => typeof p === 'string' ? p : p.name) || []
    });
    console.log('[API] ========== FETCH ALL PRODUCTS API SUCCESS ==========');
    
    return res.data;
  } catch (err) {
    console.error('[API] ========== FETCH ALL PRODUCTS API ERROR ==========');
    console.error('[API] Error type:', err.constructor.name);
    console.error('[API] Error message:', err.message);
    console.error('[API] Error details:', {
      message: err.message,
      responseStatus: err.response?.status,
      responseStatusText: err.response?.statusText,
      responseData: err.response?.data,
      hasResponse: !!err.response,
      requestUrl: err.config?.url,
      requestMethod: err.config?.method,
      cookies: document.cookie || 'No cookies found'
    });
    
    if (err.response) {
      console.error('[API] Response headers:', {
        'content-type': err.response.headers['content-type'],
        'www-authenticate': err.response.headers['www-authenticate']
      });
      console.error('[API] Response data:', err.response.data);
      
      // Special handling for 401 errors
      if (err.response.status === 401) {
        console.error('[API] 401 UNAUTHORIZED - Possible causes:');
        console.error('[API]   1. User not authenticated (no valid session cookie)');
        console.error('[API]   2. Cookie not being sent with request (CORS issue?)');
        console.error('[API]   3. Cookie expired or invalid');
        console.error('[API]   4. Server not reading cookie correctly');
        console.error('[API]   Solution: User may need to log in again');
      } else if (err.response.status === 500) {
        console.error('[API] 500 INTERNAL SERVER ERROR - Server-side issue');
      }
    } else if (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK') {
      console.error('[API] NETWORK ERROR - Possible causes:');
      console.error('[API]   1. Server is not running');
      console.error('[API]   2. CORS policy blocking the request');
      console.error('[API]   3. Network connectivity issue');
      console.error('[API]   4. Firewall blocking the request');
    }
    
    console.error('[API] ========== FETCH ALL PRODUCTS API ERROR END ==========');
    
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      const errorMessage = err.response.data.message || "Failed to fetch all products";
      console.error('[API] Throwing error with message:', errorMessage);
      throw new Error(errorMessage);
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
  console.log('[AUTH] fetchStatus called');
  console.log('[AUTH] Current cookies:', document.cookie || 'No cookies found');
  try {
    const abortController = createAbortController();
    console.log('[AUTH] Sending status request to:', `${API_BASE}/status`);
    const res = await axios.get(`${API_BASE}/status`, {
      signal: abortController.signal,
      withCredentials: true, // Important for cookies to be sent
    });
    console.log('[AUTH] Status response received:', { 
      status: res.status,
      hasData: !!res.data,
      responseStatus: res.data?.status
    });
    return res.data;
  } catch (err) {
    console.error('[AUTH] fetchStatus error:', {
      message: err.message,
      responseStatus: err.response?.status,
      responseData: err.response?.data,
      hasResponse: !!err.response,
      cookies: document.cookie || 'No cookies found'
    });
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    // Don't throw for 401/403 - let AuthContext handle it
    if (err.response?.status === 401 || err.response?.status === 403) {
      console.log('[AUTH] Status check returned 401/403 - user not authenticated');
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
  console.log('[API] ========== FETCH USER PROFILE API CALL ==========');
  console.log('[API] API Base URL:', API_BASE);
  console.log('[API] Profile endpoint:', `${API_BASE}/user/profile`);
  console.log('[API] Cookies (httpOnly not visible):', document.cookie || 'No cookies found');
  console.log('[API] Note: httpOnly cookies are sent automatically with withCredentials: true');
  
  try {
    const abortController = createAbortController();
    console.log('[API] Step 1: Sending GET request to profile endpoint...');
    console.log('[API] Request config:', {
      url: `${API_BASE}/user/profile`,
      method: 'GET',
      withCredentials: true,
      hasSignal: !!abortController.signal
    });
    
    const res = await axios.get(`${API_BASE}/user/profile`, {
      signal: abortController.signal,
      withCredentials: true, // Important for cookies to be sent
    });
    
    console.log('[API] Step 2: Profile response received');
    console.log('[API] Response status:', res.status, res.statusText);
    console.log('[API] Response data:', { 
      status: res.data?.status,
      hasUser: !!res.data?.user,
      username: res.data?.user?.username,
      email: res.data?.user?.email,
      credits: res.data?.user?.credits
    });
    console.log('[API] ========== FETCH USER PROFILE API SUCCESS ==========');
    
    return res.data;
  } catch (err) {
    console.error('[API] ========== FETCH USER PROFILE API ERROR ==========');
    console.error('[API] Error type:', err.constructor.name);
    console.error('[API] Error message:', err.message);
    console.error('[API] Error details:', {
      message: err.message,
      responseStatus: err.response?.status,
      responseStatusText: err.response?.statusText,
      responseData: err.response?.data,
      hasResponse: !!err.response,
      requestUrl: err.config?.url,
      requestMethod: err.config?.method,
      cookies: document.cookie || 'No cookies found'
    });
    
    if (err.response) {
      console.error('[API] Response headers:', {
        'content-type': err.response.headers['content-type'],
        'www-authenticate': err.response.headers['www-authenticate']
      });
      console.error('[API] Response data:', err.response.data);
      
      // Special handling for 401 errors
      if (err.response.status === 401) {
        console.error('[API] 401 UNAUTHORIZED - Possible causes:');
        console.error('[API]   1. Cookie not set by server during login');
        console.error('[API]   2. Cookie not being sent with request (CORS issue?)');
        console.error('[API]   3. Cookie expired or invalid');
        console.error('[API]   4. Server not reading cookie correctly');
      }
    }
    
    console.error('[API] ========== FETCH USER PROFILE API ERROR END ==========');
    
    if (isCancelledError(err)) {
      throw new Error("Request cancelled");
    }
    if (err.response?.data) {
      const errorMessage = err.response.data.message || "Failed to fetch user profile";
      console.error('[API] Profile fetch failed with message:', errorMessage);
      throw new Error(errorMessage);
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
