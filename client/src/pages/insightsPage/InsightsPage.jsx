import React, { useState, useEffect } from "react";
import { useTypewriter, Cursor } from "react-simple-typewriter";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./insightsPage.scss";

// Helper functions for greeting
const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
};

const getUserName = (user) => {
  if (!user) return "User";
  return user.preferred_name || user.full_name || user.username || "User";
};

const InsightsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);

  // Greeting text
  const greetingText = `Good ${getTimeOfDay()}, ${getUserName(user)}`;

  // Description text
  const descriptionText = "This platform analyzes authentic feedback from real users across forums including Reddit, Discord, and other community platforms. We extract meaningful insights from genuine conversations happening right now.";

  // Single typewriter with greeting and description sequence
  const [text] = useTypewriter({
    words: [greetingText, descriptionText],
    loop: 1,
    typeSpeed: 50,
    deleteSpeed: 40,
    delaySpeed: 1000,
  });

  // Show actions when description is fully typed
  useEffect(() => {
    if (text === descriptionText) {
      setTimeout(() => {
        setShowActions(true);
      }, 500);
    }
  }, [text, descriptionText]);

  return (
    <div className="insights-page">
      <div className="hero-section">
        <h1 className="hero-title">Real User Insights</h1>

        <p className="hero-description">
          {text}
          <Cursor cursorStyle="|" />
        </p>

        {showActions && (
          <div className="hero-actions">
            <button
              className="cta-button primary"
              onClick={() => navigate('/find-insights')}
            >
              Start Discovering Insights
            </button>
            <button
              className="cta-button secondary"
              onClick={() => navigate('/results')}
            >
              View Results
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsPage;
