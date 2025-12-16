// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useContext } from "react";
import { fetchStatus } from "../api/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is already authenticated by verifying token exists
    // and making a lightweight auth check
    const checkAuth = async () => {
      console.log('[AUTH] checkAuth called - checking authentication status');
      console.log('[AUTH] Current cookies:', document.cookie || 'No cookies found');
      try {
        // Try to fetch status - if it succeeds, user is authenticated
        // The token should be in cookies (httponly) set by the server
        const { fetchUserProfile } = await import("../api/api");
        console.log('[AUTH] Calling fetchStatus to check authentication');
        const response = await fetchStatus();
        console.log('[AUTH] fetchStatus response:', response);
        if (response && response.status === "success") {
          console.log('[AUTH] Status check successful - user is authenticated');
          setIsAuthenticated(true);
          // Fetch user profile
          try {
            console.log('[AUTH] Fetching user profile...');
            const profileResponse = await fetchUserProfile();
            console.log('[AUTH] Profile response:', profileResponse);
            if (profileResponse.status === 'success') {
              console.log('[AUTH] Profile fetch successful, setting user:', profileResponse.user?.username);
              setUser(profileResponse.user);
            } else {
              console.warn('[AUTH] Profile fetch returned non-success status:', profileResponse.status);
            }
          } catch (err) {
            console.error('[AUTH] Failed to fetch user profile:', err);
            console.error('[AUTH] Profile error details:', {
              message: err.message,
              responseStatus: err.response?.status,
              responseData: err.response?.data
            });
          }
        } else {
          console.log('[AUTH] Status check failed or returned non-success - user not authenticated');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        // Only set isAuthenticated to false if we get a 401/403 (actual auth failure)
        // Network/CORS errors should not trigger auth failure - they're connectivity issues
        const isAuthError = error.response?.status === 401 || error.response?.status === 403;
        const isNetworkError = !error.response || error.message?.includes('Network Error') || error.message?.includes('CORS');
        
        console.log('[AUTH] checkAuth error:', error.message);
        console.error('[AUTH] checkAuth error details:', {
          message: error.message,
          responseStatus: error.response?.status,
          responseData: error.response?.data,
          isAuthError,
          isNetworkError
        });
        
        if (isAuthError) {
          // Actual authentication failure - user is not authenticated
          console.log('[AUTH] Authentication error (401/403) - user not authenticated');
          setIsAuthenticated(false);
          setUser(null);
        } else if (isNetworkError) {
          // Network/CORS error - can't determine auth status
          // On initial load (isLoading was true), assume not authenticated to show login page
          // This prevents redirect loops while still allowing login page to display
          console.warn('[AUTH] Network/CORS error during auth check - cannot determine auth status');
          console.warn('[AUTH] Assuming not authenticated to allow login page to display');
          setIsAuthenticated(false);
          setUser(null);
        } else {
          // Other error - assume not authenticated
          console.log('[AUTH] Other error during auth check - assuming not authenticated');
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        console.log('[AUTH] checkAuth complete, setting isLoading to false');
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (userData = null) => {
    console.log('[AUTH] ========== LOGIN FUNCTION CALLED ==========');
    console.log('[AUTH] Timestamp:', new Date().toISOString());
    console.log('[AUTH] User data provided:', !!userData);
    console.log('[AUTH] Step 1: Setting isAuthenticated to true');
    console.log('[AUTH] Current auth state before login:', { isAuthenticated, user: user?.username || 'null' });
    setIsAuthenticated(true);
    console.log('[AUTH] isAuthenticated set to true');
    
    // IMPROVEMENT: If user data is provided directly (from login response), use it immediately
    if (userData) {
      console.log('[AUTH] User data provided in login call, setting immediately:', {
        username: userData.username,
        preferred_name: userData.preferred_name,
        full_name: userData.full_name
      });
      setUser(userData);
      console.log('[AUTH] User data set from login response');
      console.log('[AUTH] ========== LOGIN COMPLETE WITH PROVIDED DATA ==========');
      return; // No need to fetch profile
    }
    
    // Wait longer for the cookie to be set by the browser
    // httpOnly cookies are set by the browser and may take a moment
    // Also, we need to ensure the response has been fully processed
    console.log('[AUTH] Step 2: Waiting 300ms for cookie to be set by browser...');
    const waitStartTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 300));
    const waitEndTime = Date.now();
    console.log(`[AUTH] Wait completed in ${waitEndTime - waitStartTime}ms`);
    
    // Log cookie information (note: httpOnly cookies won't show in document.cookie)
    console.log('[AUTH] Step 3: Checking cookies (httpOnly cookies may not be visible):', document.cookie || 'No cookies found');
    console.log('[AUTH] Step 3: Cookie count:', document.cookie ? document.cookie.split(';').length : 0);
    console.log('[AUTH] Step 3: Note - httpOnly cookies are not accessible via document.cookie, but should be sent automatically with requests');
    console.log('[AUTH] Step 3: Current URL:', window.location.href);
    console.log('[AUTH] Step 3: Document domain:', document.domain);
    
    // Fetch user profile after login with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 200;
    
    console.log('[AUTH] Step 4: Starting profile fetch with retry logic');
    console.log(`[AUTH] Retry configuration: maxRetries=${maxRetries}, baseDelay=${baseDelay}ms`);
    
    while (retryCount < maxRetries) {
      const attemptStartTime = Date.now();
      try {
        console.log(`[AUTH] ========== PROFILE FETCH ATTEMPT ${retryCount + 1}/${maxRetries} ==========`);
        console.log(`[AUTH] Attempt ${retryCount + 1} start time:`, new Date().toISOString());
        console.log(`[AUTH] Attempt ${retryCount + 1}: Importing fetchUserProfile...`);
        
        const { fetchUserProfile } = await import("../api/api");
        console.log(`[AUTH] Attempt ${retryCount + 1}: fetchUserProfile imported, calling API...`);
        console.log(`[AUTH] Attempt ${retryCount + 1}: API endpoint should be: ${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/user/profile`);
        console.log(`[AUTH] Attempt ${retryCount + 1}: withCredentials should be: true`);
        
        const profileResponse = await fetchUserProfile();
        const attemptEndTime = Date.now();
        const attemptDuration = attemptEndTime - attemptStartTime;
        
        console.log(`[AUTH] Attempt ${retryCount + 1}: Profile response received in ${attemptDuration}ms`);
        console.log(`[AUTH] Attempt ${retryCount + 1}: Profile response:`, {
          status: profileResponse.status,
          hasUser: !!profileResponse.user,
          username: profileResponse.user?.username,
          email: profileResponse.user?.email,
          full_name: profileResponse.user?.full_name,
          preferred_name: profileResponse.user?.preferred_name,
          birthday: profileResponse.user?.birthday,
          credits: profileResponse.user?.credits
        });
        
        if (profileResponse.status === 'success') {
          console.log(`[AUTH] Attempt ${retryCount + 1}: SUCCESS! Profile fetch successful!`);
          console.log('[AUTH] Setting user state with profile data:', {
            username: profileResponse.user?.username,
            email: profileResponse.user?.email,
            full_name: profileResponse.user?.full_name,
            preferred_name: profileResponse.user?.preferred_name
          });
          setUser(profileResponse.user);
          console.log('[AUTH] User state updated');
          console.log('[AUTH] ========== LOGIN COMPLETE SUCCESSFULLY ==========');
          return; // Success, exit retry loop
        } else {
          console.warn(`[AUTH] Attempt ${retryCount + 1}: Profile fetch returned non-success status:`, profileResponse.status);
          console.warn(`[AUTH] Attempt ${retryCount + 1}: Response message:`, profileResponse.message);
          if (retryCount < maxRetries - 1) {
            const nextRetryDelay = baseDelay * (retryCount + 1);
            console.log(`[AUTH] Attempt ${retryCount + 1}: Will retry in ${nextRetryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, nextRetryDelay));
            retryCount++;
            continue;
          } else {
            console.error(`[AUTH] Attempt ${retryCount + 1}: Max retries reached, giving up`);
          }
        }
      } catch (err) {
        const attemptEndTime = Date.now();
        const attemptDuration = attemptEndTime - attemptStartTime;
        console.error(`[AUTH] ========== PROFILE FETCH ATTEMPT ${retryCount + 1} FAILED ==========`);
        console.error(`[AUTH] Attempt ${retryCount + 1} duration: ${attemptDuration}ms`);
        console.error(`[AUTH] Attempt ${retryCount + 1} error type:`, err.constructor.name);
        console.error(`[AUTH] Attempt ${retryCount + 1} error message:`, err.message);
        console.error(`[AUTH] Attempt ${retryCount + 1} error details:`, {
          message: err.message,
          responseStatus: err.response?.status,
          responseStatusText: err.response?.statusText,
          responseData: err.response?.data,
          hasResponse: !!err.response,
          requestUrl: err.config?.url,
          requestMethod: err.config?.method,
          requestHeaders: err.config?.headers,
          stack: err.stack?.split('\n').slice(0, 10).join('\n')
        });
        
        // If it's a 401/403, the cookie might not be set yet, retry
        if ((err.response?.status === 401 || err.response?.status === 403) && retryCount < maxRetries - 1) {
          const nextRetryDelay = baseDelay * (retryCount + 1);
          console.log(`[AUTH] Attempt ${retryCount + 1}: Authentication error (${err.response?.status}), will retry in ${nextRetryDelay}ms...`);
          console.log(`[AUTH] Attempt ${retryCount + 1}: This might be due to cookie not being set yet`);
          await new Promise(resolve => setTimeout(resolve, nextRetryDelay));
          retryCount++;
          continue;
        }
        
        // If it's a network/CORS error, also retry
        if ((err.message?.includes('Network Error') || err.message?.includes('CORS') || !err.response) && retryCount < maxRetries - 1) {
          const nextRetryDelay = baseDelay * (retryCount + 1);
          console.log(`[AUTH] Attempt ${retryCount + 1}: Network/CORS error, will retry in ${nextRetryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, nextRetryDelay));
          retryCount++;
          continue;
        }
        
        // If we've exhausted retries or it's a different error, log and continue
        console.error('[AUTH] ========== ALL PROFILE FETCH ATTEMPTS FAILED ==========');
        console.error('[AUTH] Total attempts:', retryCount + 1);
        console.error('[AUTH] User is still authenticated, but profile data unavailable.');
        console.error('[AUTH] This is not critical - profile can be fetched later when needed.');
        console.error('[AUTH] Final error summary:', {
          lastError: err.message,
          lastStatus: err.response?.status,
          lastResponseData: err.response?.data
        });
        console.log('[AUTH] ========== LOGIN COMPLETE (WITH WARNING) ==========');
        return; // Exit retry loop, user is still authenticated
      }
    }
    
    console.error('[AUTH] ========== RETRY LOOP EXHAUSTED ==========');
    console.error('[AUTH] This should not happen - loop should have returned earlier');
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
