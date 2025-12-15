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
      try {
        // Try to fetch status - if it succeeds, user is authenticated
        // The token should be in cookies (httponly) set by the server
        const { fetchUserProfile } = await import("../api/api");
        const response = await fetchStatus();
        if (response && response.status === "success") {
          setIsAuthenticated(true);
          // Fetch user profile
          try {
            const profileResponse = await fetchUserProfile();
            if (profileResponse.status === 'success') {
              setUser(profileResponse.user);
            }
          } catch (err) {
            console.error('Failed to fetch user profile:', err);
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        // If we get an error (401/403), user is not authenticated
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async () => {
    setIsAuthenticated(true);
    // Fetch user profile after login
    try {
      const { fetchUserProfile } = await import("../api/api");
      const profileResponse = await fetchUserProfile();
      if (profileResponse.status === 'success') {
        setUser(profileResponse.user);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
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
