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
        // If we get an error (401/403), user is not authenticated
        console.log('[AUTH] checkAuth error - user not authenticated:', error.message);
        console.error('[AUTH] checkAuth error details:', {
          message: error.message,
          responseStatus: error.response?.status,
          responseData: error.response?.data
        });
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        console.log('[AUTH] checkAuth complete, setting isLoading to false');
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async () => {
    console.log('[AUTH] ========== LOGIN FUNCTION CALLED ==========');
    console.log('[AUTH] Step 1: Setting isAuthenticated to true');
    setIsAuthenticated(true);
    
    // Wait longer for the cookie to be set by the browser
    // httpOnly cookies are set by the browser and may take a moment
    // Also, we need to ensure the response has been fully processed
    console.log('[AUTH] Step 2: Waiting 300ms for cookie to be set by browser...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Log cookie information (note: httpOnly cookies won't show in document.cookie)
    console.log('[AUTH] Step 3: Checking cookies (httpOnly cookies may not be visible):', document.cookie || 'No cookies found');
    console.log('[AUTH] Step 3: Note - httpOnly cookies are not accessible via document.cookie, but should be sent automatically with requests');
    
    // Fetch user profile after login with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 200;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`[AUTH] Step 4.${retryCount + 1}: Attempting to fetch user profile (attempt ${retryCount + 1}/${maxRetries})...`);
        const { fetchUserProfile } = await import("../api/api");
        const profileResponse = await fetchUserProfile();
        console.log('[AUTH] Step 5: Profile response received:', {
          status: profileResponse.status,
          hasUser: !!profileResponse.user,
          username: profileResponse.user?.username,
          email: profileResponse.user?.email
        });
        
        if (profileResponse.status === 'success') {
          console.log('[AUTH] Step 6: Profile fetch successful! Setting user:', profileResponse.user?.username);
          setUser(profileResponse.user);
          console.log('[AUTH] ========== LOGIN COMPLETE ==========');
          return; // Success, exit retry loop
        } else {
          console.warn('[AUTH] Profile fetch returned non-success status:', profileResponse.status);
          if (retryCount < maxRetries - 1) {
            console.log(`[AUTH] Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryCount++;
            continue;
          }
        }
      } catch (err) {
        console.error(`[AUTH] Profile fetch attempt ${retryCount + 1} failed:`, {
          message: err.message,
          responseStatus: err.response?.status,
          responseData: err.response?.data,
          stack: err.stack
        });
        
        // If it's a 401/403, the cookie might not be set yet, retry
        if ((err.response?.status === 401 || err.response?.status === 403) && retryCount < maxRetries - 1) {
          console.log(`[AUTH] Authentication error (${err.response?.status}), retrying in ${retryDelay * (retryCount + 1)}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
          retryCount++;
          continue;
        }
        
        // If we've exhausted retries or it's a different error, log and continue
        console.error('[AUTH] All profile fetch attempts failed. User is still authenticated, but profile data unavailable.');
        console.error('[AUTH] This is not critical - profile can be fetched later when needed.');
        console.log('[AUTH] ========== LOGIN COMPLETE (WITH WARNING) ==========');
        return; // Exit retry loop, user is still authenticated
      }
    }
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
