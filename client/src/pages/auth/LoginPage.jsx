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
    setError("");
    setIsLoading(true);

    try {
      const response = await loginUser({ username, password });

      if (response.status === "success") {
        // Call the onLoginSuccess callback to update auth state
        onLoginSuccess();
      } else {
        setError(response.message || "Login failed");
      }
    } catch (err) {
      setError(
        err.message ||
        err.response?.data?.message ||
        "Authentication failed. Please check your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful registration
  const handleRegisterSuccess = (registeredUsername) => {
    setShowRegister(false);
    setError("");
    // Auto-fill the login form with the registered username
    if (registeredUsername) {
      setUsername(registeredUsername);
    }
    setPassword("");
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
