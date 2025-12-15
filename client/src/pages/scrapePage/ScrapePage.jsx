import React, { useState, useEffect, useMemo } from "react";
import { triggerScrape, fetchStatus } from "@/api/api.js";
import { useNotification } from "@/context/NotificationContext";
import "./scrapePage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";
import LoadingState from "@/components/LoadingState/LoadingState";

// Calculate estimated cost (matches server logic)
const calculateEstimatedCost = (timeFilter) => {
  const baseCost = 1;
  const timeMultipliers = {
    'hour': 0.5,
    'day': 0.7,
    'week': 1.0,
    'month': 1.5,
    'year': 2.0,
    'all': 3.0
  };
  const timeMult = timeMultipliers[timeFilter] || 1.0;
  const postMult = Math.max(1.0, 100 / 50); // Default 100 posts
  const cost = Math.floor(baseCost * timeMult * postMult);
  return Math.max(1, Math.min(10, cost));
};

const ScrapePage = () => {
  const [insightType, setInsightType] = useState("product");
  const [loading, setLoading] = useState(false);
  const [scrapeInProgress, setScrapeInProgress] = useState(false);
  const { showNotification } = useNotification();
  const [errors, setErrors] = useState({});
  
  // Initialize form data from localStorage or use defaults
  const [formData, setFormData] = useState(() => {
    try {
      const savedData = localStorage.getItem("scrape_form_data");
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (err) {
      console.error("Error parsing localStorage data:", err);
    }

    // Default values if nothing in localStorage
    return {
      topic: "",
      time_filter: "week",
      insightType: "product", // 'product' or 'custom'
    };
  });

  // Periodically check scrape status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await fetchStatus();
        setScrapeInProgress(status.scrape_in_progress);

        // If insight discovery was in progress but now completed, show notification
        if (scrapeInProgress && !status.scrape_in_progress) {
          showNotification("Insights discovered!", "success");
          setScrapeInProgress(false);
        }
      } catch (err) {
        console.error("Error fetching status:", err);
      }
    };

    // Check immediately
    checkStatus();

    // Then set up interval
    const intervalId = setInterval(checkStatus, 10000); // Check every 10 seconds

    return () => clearInterval(intervalId);
  }, [scrapeInProgress, showNotification]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("scrape_form_data", JSON.stringify(formData));
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear error for this field when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: undefined,
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.topic || formData.topic.trim().length === 0) {
      newErrors.topic = "Topic or product name is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleScrape = async () => {
    // Validate form before submitting
    if (!validateForm()) {
      showNotification("Please fix the errors in the form", "error");
      return;
    }
    
    setLoading(true);
    setErrors({});
    try {
      const data = await triggerScrape({
        topic: formData.topic.trim(),
        limit: 100, // Default limit
        time_filter: formData.time_filter,
        is_custom: insightType === "custom",
      });
      setScrapeInProgress(true);

      // Create a formatted message for the notification
      const notificationMessage = `Discovering insights for "${data.topic}"...`;

      showNotification(notificationMessage, "info", 8000);

      // Trigger a custom event to notify StatusBar to refresh after a short delay
      // This gives the backend time to update the scrape_in_progress status
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('scrapeStarted'));
      }, 2000); // Wait 2 seconds for backend to update status
    } catch (err) {
      console.error(err);
      showNotification(err.message || "Failed to discover insights", "error");
    } finally {
      setLoading(false);
    }
  };

  // Reset to default values
  const handleReset = () => {
    const defaultData = {
      topic: "",
      time_filter: "week",
      insightType: insightType,
    };

    setFormData(defaultData);
    setErrors({});
    // Update localStorage with defaults
    localStorage.setItem("scrape_form_data", JSON.stringify(defaultData));
  };
  
  // Calculate cost for the current mode
  const estimatedCost = useMemo(() => {
    return calculateEstimatedCost(formData.time_filter);
  }, [formData.time_filter]);

  return (
    <div className="scrape-page">
      <PageHeader
        title="Find Insights"
        description="Discover insights about products, features, market gaps, or opportunities"
      />

      {/* Insight Type Toggle */}
      <div className="insight-type-toggle">
        <button
          className={`toggle-option ${insightType === "product" ? "active" : ""}`}
          onClick={() => setInsightType("product")}
        >
          Product Insights
        </button>
        <button
          className={`toggle-option ${insightType === "custom" ? "active" : ""}`}
          onClick={() => setInsightType("custom")}
        >
          Custom Insights
        </button>
      </div>

      {insightType === "product" ? (
        <div className="cards-container">
        {/* Topic/Product Input Section */}
        <div className="card">
          <h2 className="card-title">Topic or Product</h2>
          <p className="card-description">
            Enter a topic, product name, or technology. Our AI will automatically discover relevant discussions and insights.
          </p>
          {errors.topic && (
            <div className="error-message">{errors.topic}</div>
          )}
          <div className="input-group">
            <input
              type="text"
              name="topic"
              value={formData.topic}
              onChange={handleInputChange}
              placeholder="e.g., VS Code, React, Docker, Notion, Cursor..."
              className="custom-input topic-input"
            />
          </div>
        </div>

        {/* Settings Section */}
        <div className="card">
          <h2 className="card-title">Settings</h2>

          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">Timeline</label>
              <select
                name="time_filter"
                value={formData.time_filter}
                onChange={handleInputChange}
                className="select-input"
              >
                <option value="hour">Past Hour</option>
                <option value="day">Past Day</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>

        </div>

        <div className="actions-container">
          <button
            onClick={handleReset}
            className="reset-button"
            disabled={loading}
          >
            Clear All
          </button>
          <button
            onClick={handleScrape}
            disabled={loading || scrapeInProgress}
            className="scrape-button"
          >
            {loading
              ? "Starting..."
              : scrapeInProgress
              ? "Discovering Insights..."
              : `Find Insights (-${estimatedCost} credits)`}
          </button>
        </div>
      </div>
      ) : (
        <div className="custom-insights-container">
          <div className="card">
            <h2 className="card-title">Custom Insights Prompt</h2>
            <p className="card-description">
              Describe what you want to discover. Claude AI will recommend the best subreddits, timeline, and search strategy.
            </p>
            {errors.topic && (
              <div className="error-message">{errors.topic}</div>
            )}
            <div className="input-group">
              <textarea
                name="topic"
                value={formData.topic}
                onChange={handleInputChange}
                placeholder="e.g., Find market gaps in productivity tools, discover pain points with remote work software, identify opportunities in developer tools..."
                className="custom-input topic-textarea"
                rows={6}
              />
            </div>
          </div>
          <div className="actions-container">
            <button
              onClick={handleReset}
              className="reset-button"
              disabled={loading}
            >
              Clear
            </button>
            <button
              onClick={handleScrape}
              disabled={loading || scrapeInProgress}
              className="scrape-button"
            >
              {loading
                ? "Starting..."
                : scrapeInProgress
                ? "Discovering Insights..."
                : `Generate Custom Insights (-${estimatedCost} credits)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScrapePage;
