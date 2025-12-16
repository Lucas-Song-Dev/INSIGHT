// src/pages/auth/LoginPage.jsx
import { useState } from "react";
import { loginUser } from "../../api/api";
import RegisterForm from "./RegisterForm";
import "./loginpage.scss";

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[LOGIN PAGE] ========== LOGIN FORM SUBMITTED ==========');
    console.log('[LOGIN PAGE] Username:', username);
    console.log('[LOGIN PAGE] Has password:', !!password);
    setError("");
    setIsLoading(true);

    try {
      console.log('[LOGIN PAGE] Step 1: Calling loginUser API...');
      const response = await loginUser({ username, password });
      console.log('[LOGIN PAGE] Step 2: Login API response received:', {
        status: response.status,
        message: response.message,
        hasUser: !!response.user
      });

      if (response.status === "success") {
        console.log('[LOGIN PAGE] Step 3: Login API returned success');
        console.log('[LOGIN PAGE] User data in response:', {
          hasUser: !!response.user,
          username: response.user?.username,
          preferred_name: response.user?.preferred_name,
          full_name: response.user?.full_name
        });
        console.log('[LOGIN PAGE] Step 4: Calling onLoginSuccess callback with user data...');
        // IMPROVEMENT: Pass user data to login callback for immediate use
        await onLoginSuccess(response.user);
        console.log('[LOGIN PAGE] Step 5: onLoginSuccess callback completed');
        console.log('[LOGIN PAGE] ========== LOGIN FLOW COMPLETE ==========');
      } else {
        console.warn('[LOGIN PAGE] Login API returned non-success status:', response.status);
        console.warn('[LOGIN PAGE] Error message:', response.message);
        setError(response.message || "Login failed");
        console.log('[LOGIN PAGE] ========== LOGIN FAILED ==========');
      }
    } catch (err) {
      console.error('[LOGIN PAGE] ========== LOGIN ERROR ==========');
      console.error('[LOGIN PAGE] Error type:', err.constructor.name);
      console.error('[LOGIN PAGE] Error message:', err.message);
      console.error('[LOGIN PAGE] Error details:', {
        message: err.message,
        responseStatus: err.response?.status,
        responseData: err.response?.data,
        hasResponse: !!err.response,
        stack: err.stack?.split('\n').slice(0, 5).join('\n')
      });
      setError(
        err.message ||
        err.response?.data?.message ||
        "Authentication failed. Please check your credentials."
      );
      console.log('[LOGIN PAGE] ========== LOGIN ERROR HANDLED ==========');
    } finally {
      console.log('[LOGIN PAGE] Setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Handle successful registration
  const handleRegisterSuccess = async (registeredUsername, registeredPassword) => {
    console.log('[LOGIN PAGE] ========== REGISTRATION SUCCESS HANDLER ==========');
    console.log('[LOGIN PAGE] Registered username:', registeredUsername);
    console.log('[LOGIN PAGE] Has password:', !!registeredPassword);
    
    setShowRegister(false);
    setError("");
    
    // Auto-login after successful registration
    if (registeredUsername && registeredPassword) {
      console.log('[LOGIN PAGE] Auto-logging in user after registration...');
      setIsLoading(true);
      try {
        console.log('[LOGIN PAGE] Step 1: Calling loginUser API with registered credentials...');
        const response = await loginUser({ username: registeredUsername, password: registeredPassword });
        console.log('[LOGIN PAGE] Step 2: Auto-login API response:', {
          status: response.status,
          message: response.message
        });
        
        if (response.status === "success") {
          console.log('[LOGIN PAGE] Step 3: Auto-login successful, calling onLoginSuccess...');
          console.log('[LOGIN PAGE] User data in auto-login response:', {
            hasUser: !!response.user,
            username: response.user?.username
          });
          // IMPROVEMENT: Pass user data to login callback
          await onLoginSuccess(response.user);
          console.log('[LOGIN PAGE] Step 4: onLoginSuccess completed');
          console.log('[LOGIN PAGE] ========== AUTO-LOGIN AFTER REGISTRATION COMPLETE ==========');
        } else {
          console.warn('[LOGIN PAGE] Auto-login failed, showing login form');
          setUsername(registeredUsername);
          setPassword("");
          setError("Registration successful! Please log in.");
        }
      } catch (err) {
        console.error('[LOGIN PAGE] Auto-login error:', err);
        // Fall back to manual login
        setUsername(registeredUsername);
        setPassword("");
        setError("Registration successful! Please log in.");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Fallback: just fill in the username
      if (registeredUsername) {
        setUsername(registeredUsername);
      }
      setPassword("");
    }
  };

  return (
    <div className="login-container">
      {showRegister ? (
        <RegisterForm
          onRegisterSuccess={handleRegisterSuccess}
          onCancel={() => setShowRegister(false)}
        />
      ) : (
        <div className="login-card">
          <h2>INSIGHT Login</h2>
          <p className="login-description">
            Enter your credentials to access the dashboard
          </p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Log In"}
            </button>
            
            <div className="register-prompt">
              <p>Don't have an account?</p>
              <button
                type="button"
                className="register-link"
                onClick={() => setShowRegister(true)}
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
