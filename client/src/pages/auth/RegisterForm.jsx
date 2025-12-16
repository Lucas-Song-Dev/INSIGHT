// src/pages/auth/RegisterForm.jsx
import { useState } from "react";
import { registerUser } from "../../api/api";
import "./registerForm.scss";

const RegisterForm = ({ onRegisterSuccess, onCancel }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[REGISTER FORM] ========== REGISTRATION FORM SUBMITTED ==========');
    console.log('[REGISTER FORM] Form data:', {
      username,
      hasPassword: !!password,
      hasEmail: !!email,
      fullName,
      preferredName,
      birthday
    });
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      console.warn('[REGISTER FORM] Password validation failed: passwords do not match');
      setError("Passwords do not match");
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      console.warn('[REGISTER FORM] Password validation failed: password too short');
      setError("Password must be at least 8 characters long");
      return;
    }

    // Validate required fields
    if (!fullName.trim()) {
      console.warn('[REGISTER FORM] Validation failed: full name is required');
      setError("Full name is required");
      return;
    }

    if (!preferredName.trim()) {
      console.warn('[REGISTER FORM] Validation failed: preferred name is required');
      setError("Preferred name is required");
      return;
    }

    if (!birthday) {
      console.warn('[REGISTER FORM] Validation failed: birthday is required');
      setError("Birthday is required");
      return;
    }

    console.log('[REGISTER FORM] Step 1: All validations passed');
    console.log('[REGISTER FORM] Step 2: Setting loading state to true');
    setIsLoading(true);

    try {
      console.log('[REGISTER FORM] Step 3: Calling registerUser API...');
      const response = await registerUser({
        username,
        password,
        email: email || undefined, // Only include if provided
        full_name: fullName.trim(),
        preferred_name: preferredName.trim(),
        birthday: birthday
      });
      console.log('[REGISTER FORM] Step 4: Registration response received:', {
        status: response?.status,
        message: response?.message
      });

      // Registration successful
      if (response.status === "success") {
        console.log('[REGISTER FORM] Step 5: Registration successful, calling onRegisterSuccess');
        // Pass both username and password for auto-login
        onRegisterSuccess(username, password);
        console.log('[REGISTER FORM] ========== REGISTRATION COMPLETE ==========');
      } else {
        console.warn('[REGISTER FORM] Registration returned non-success status:', response.status);
        console.warn('[REGISTER FORM] Error message:', response.message);
        setError(response.message || "Registration failed");
        console.log('[REGISTER FORM] ========== REGISTRATION FAILED ==========');
      }
    } catch (err) {
      console.error('[REGISTER FORM] ========== REGISTRATION ERROR ==========');
      console.error('[REGISTER FORM] Error type:', err.constructor.name);
      console.error('[REGISTER FORM] Error message:', err.message);
      console.error('[REGISTER FORM] Error details:', {
        message: err.message,
        responseStatus: err.response?.status,
        responseData: err.response?.data,
        hasResponse: !!err.response
      });
      setError(
        err.message ||
        err.response?.data?.message ||
        "Registration failed. Please try again."
      );
      console.log('[REGISTER FORM] ========== REGISTRATION ERROR HANDLED ==========');
    } finally {
      console.log('[REGISTER FORM] Setting loading state to false');
      setIsLoading(false);
    }
  };

  return (
    <div className="register-form">
      <h2>Create Account</h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-full-name">Full Name</label>
          <input
            id="register-full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-preferred-name">What should we call you?</label>
          <input
            id="register-preferred-name"
            type="text"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            placeholder="Enter your preferred name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-birthday">Birthday</label>
          <input
            id="register-birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-email">Email (optional)</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password (min. 8 characters)"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-confirm-password">Confirm Password</label>
          <input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
          />
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;
