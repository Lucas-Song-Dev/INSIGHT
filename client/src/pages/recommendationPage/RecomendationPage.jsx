// Recommendations.jsx
import { useEffect, useState } from "react";
import {
  fetchSavedRecommendations,
  generateRecommendations,
} from "@/api/api.js";
import "./recommendation.scss";

const Recommendations = ({ productData = null }) => {
  // State management
  const [recommendations, setRecommendations] = useState(productData ? [productData] : []);
  const [filteredRecommendations, setFilteredRecommendations] = useState(productData ? [productData] : []);
  const [loading, setLoading] = useState(!productData);
  const [error, setError] = useState(null);
  const [severityFilters, setSeverityFilters] = useState({
    low: true,
    medium: true,
    high: true,
  });

  // Filters and sorting
  const [products, setProducts] = useState(() => {
    try {
      const savedProducts = localStorage.getItem("recommendations_products");
      return savedProducts ? JSON.parse(savedProducts) : ["Cursor"];
    } catch (err) {
      console.error("Error parsing products from localStorage:", err);
      return ["Cursor"];
    }
  });
  const [productInput, setProductInput] = useState("");
  const [minSeverity, setMinSeverity] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCriteria, setSortCriteria] = useState("impact");
  const [sortDirection, setSortDirection] = useState("desc");
  const [complexityFilter, setComplexityFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState("all");

  // UI state
  const [expandedRecs, setExpandedRecs] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  // Save products to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("recommendations_products", JSON.stringify(products));
  }, [products]);
  // In Recommendations.jsx
  // Update the fetchData function

  // Add this handler function
  const handleSeverityCheckboxChange = (severity) => {
    setSeverityFilters((prev) => ({
      ...prev,
      [severity]: !prev[severity],
    }));
  };

  const fetchData = async (forceGenerate = false) => {
    setLoading(true);
    setError(null);

    try {
      let data;

      if (forceGenerate) {
        // Generate new recommendations
        data = await generateRecommendations({
          products: products,
        });
      } else {
        // Try to get saved recommendations first
        data = await fetchSavedRecommendations({
          products: products,
        });

        // If no recommendations found, generate new ones
        if (!data.recommendations || data.recommendations.length === 0) {
          setLoading(true); // Keep loading state active
          data = await generateRecommendations({
            products: products,
          });
        }
      }

      setRecommendations(data.recommendations || []);
      setFilteredRecommendations(data.recommendations || []);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      setError(
        "Failed to fetch recommendations. Please check your API key and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    if (!productData) {
      fetchData();
    }
  }, []);

  // Filter and sort recommendations based on criteria
  useEffect(() => {
    if (!recommendations.length) return;

    let filtered = [...recommendations];

    // Flatten recommendations into a more usable format
    let flattenedRecs = [];
    filtered.forEach((productRec) => {
      if (
        productRec.recommendations &&
        Array.isArray(productRec.recommendations)
      ) {
        productRec.recommendations.forEach((rec) => {
          flattenedRecs.push({
            ...rec,
            product: productRec.product,
            timestamp: productRec.timestamp,
            summary: productRec.summary,
          });
        });
      }
    });

    // Apply complexity filter
    if (complexityFilter !== "all") {
      flattenedRecs = flattenedRecs.filter(
        (rec) => rec.complexity?.toLowerCase() === complexityFilter
      );
    }

    // Apply impact filter
    if (impactFilter !== "all") {
      flattenedRecs = flattenedRecs.filter(
        (rec) => rec.impact?.toLowerCase() === impactFilter
      );
    }

    // Apply severity filters - filter out items that don't match any of the selected severity levels
    flattenedRecs = flattenedRecs.filter((rec) => {
      const complexity = rec.complexity?.toLowerCase();
      const impact = rec.impact?.toLowerCase();

      // Check if the recommendation's complexity or impact matches any enabled severity filter
      return (
        (complexity && severityFilters[complexity]) ||
        (impact && severityFilters[impact])
      );
    });

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      flattenedRecs = flattenedRecs.filter((rec) => {
        return (
          rec.title?.toLowerCase().includes(term) ||
          rec.description?.toLowerCase().includes(term) ||
          rec.product?.toLowerCase().includes(term) ||
          (rec.addresses_pain_points &&
            rec.addresses_pain_points.some((p) =>
              p.toLowerCase().includes(term)
            ))
        );
      });
    }

    // Sort recommendations
    flattenedRecs.sort((a, b) => {
      let valueA, valueB;

      // Determine sort values
      switch (sortCriteria) {
        case "title":
          valueA = a.title?.toLowerCase() || "";
          valueB = b.title?.toLowerCase() || "";
          break;
        case "complexity": {
          const complexityMap = { high: 3, medium: 2, low: 1 };
          valueA = complexityMap[a.complexity?.toLowerCase()] || 0;
          valueB = complexityMap[b.complexity?.toLowerCase()] || 0;
          break;
        }
        case "impact": {
          const impactMap = { high: 3, medium: 2, low: 1 };
          valueA = impactMap[a.impact?.toLowerCase()] || 0;
          valueB = impactMap[b.impact?.toLowerCase()] || 0;
          break;
        }
        case "recency": {
          valueA = a.most_recent_occurence || "";
          valueB = b.most_recent_occurence || "";
          break;
        }
        default:
          valueA = a.title?.toLowerCase() || "";
          valueB = b.title?.toLowerCase() || "";
      }

      // Apply sort direction
      return sortDirection === "asc"
        ? valueA > valueB
          ? 1
          : -1
        : valueA < valueB
        ? 1
        : -1;
    });

    // Group by product again
    const groupedRecs = {};
    flattenedRecs.forEach((rec) => {
      if (!groupedRecs[rec.product]) {
        groupedRecs[rec.product] = {
          product: rec.product,
          recommendations: [],
          timestamp: rec.timestamp,
          summary: rec.summary,
        };
      }
      groupedRecs[rec.product].recommendations.push(rec);
    });

    setFilteredRecommendations(Object.values(groupedRecs));
  }, [
    recommendations,
    searchTerm,
    complexityFilter,
    impactFilter,
    sortCriteria,
    sortDirection,
  ]);

  // Toggle recommendation expansion
  const toggleRecommendation = (productIndex, recIndex) => {
    const key = `${productIndex}-${recIndex}`;
    setExpandedRecs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Handle product input change
  const handleProductInputChange = (e) => {
    setProductInput(e.target.value);
  };

  // Add a product to the products array
  const addProduct = (e) => {
    e.preventDefault();
    if (productInput.trim() && !products.includes(productInput.trim())) {
      setProducts((prev) => [...prev, productInput.trim()]);
      setProductInput("");
    }
  };

  // Remove a product from the products array
  const removeProduct = (productToRemove) => {
    setProducts((prev) => prev.filter((p) => p !== productToRemove));
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle min severity change
  const handleMinSeverityChange = (e) => {
    setMinSeverity(parseFloat(e.target.value));
  };

  // Handle form submission
  const handleSubmit = (forceGenerate = false) => {
    fetchData(forceGenerate);
  };

  // Handle sort criteria change
  const handleSortChange = (e) => {
    setSortCriteria(e.target.value);
  };

  // Handle sort direction change
  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  // Handle complexity filter change
  const handleComplexityFilterChange = (e) => {
    setComplexityFilter(e.target.value);
  };

  // Handle impact filter change
  const handleImpactFilterChange = (e) => {
    setImpactFilter(e.target.value);
  };

  // Toggle advanced filters visibility
  const toggleFilters = () => {
    setShowFilters((prev) => !prev);
  };

  // Helper function to get severity class based on complexity or impact
  const getSeverityClass = (value) => {
    switch (value?.toLowerCase()) {
      case "high":
        return "severity-high";
      case "medium":
        return "severity-medium";
      case "low":
        return "severity-low";
      default:
        return "severity-unknown";
    }
  };

  return (
    <div className="recommendations-container">
      <div className="recommendations-header">
        <h2>Product Recommendations</h2>
        <p>AI-generated suggestions to address user pain points</p>
      </div>

      {/* Products Selection */}
      <div className="products-section">
        <form onSubmit={addProduct} className="product-form">
          <div className="input-group">
            <label>Add Product</label>
            <div className="product-input-container">
              <input
                type="text"
                value={productInput}
                onChange={handleProductInputChange}
                placeholder="Enter product name"
              />
              <button type="submit">Add</button>
            </div>
          </div>
        </form>

        <div className="selected-products">
          <label>Selected Products</label>
          <div className="product-tags">
            {products.map((prod, index) => (
              <div key={index} className="product-tag">
                <span>{prod}</span>
                <button
                  className="remove-product"
                  onClick={() => removeProduct(prod)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="severity-filter-container">
          <label>Severity Filters</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={severityFilters.low}
                onChange={() => handleSeverityCheckboxChange("low")}
              />
              <span
                className={`severity-checkbox severity-low ${
                  severityFilters.low ? "checked" : ""
                }`}
              >
                Low
              </span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={severityFilters.medium}
                onChange={() => handleSeverityCheckboxChange("medium")}
              />
              <span
                className={`severity-checkbox severity-medium ${
                  severityFilters.medium ? "checked" : ""
                }`}
              >
                Medium
              </span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={severityFilters.high}
                onChange={() => handleSeverityCheckboxChange("high")}
              />
              <span
                className={`severity-checkbox severity-high ${
                  severityFilters.high ? "checked" : ""
                }`}
              >
                High
              </span>
            </label>
          </div>
        </div>

        <div className="button-group">
          <button
            onClick={() => handleSubmit(false)}
            disabled={loading || products.length === 0}
            className="analyze-button"
          >
            {loading ? "Loading..." : "Get Recommendations"}
          </button>

          <button
            onClick={() => handleSubmit(true)}
            disabled={loading || products.length === 0}
            className="regenerate-button"
          >
            {loading ? "Loading..." : "Generate New Recommendations"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search in recommendations..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
          <div className="search-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Advanced Filters Button */}
      <button className="toggle-filters-button" onClick={toggleFilters}>
        {showFilters ? "Hide Advanced Filters" : "Show Advanced Filters"}
      </button>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="advanced-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label>Complexity</label>
              <select
                value={complexityFilter}
                onChange={handleComplexityFilterChange}
                className="filter-select"
              >
                <option value="all">All Complexity</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Impact</label>
              <select
                value={impactFilter}
                onChange={handleImpactFilterChange}
                className="filter-select"
              >
                <option value="all">All Impact Levels</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={sortCriteria}
                onChange={handleSortChange}
                className="filter-select"
              >
                <option value="title">Title</option>
                <option value="complexity">Complexity</option>
                <option value="impact">Impact</option>
                <option value="recency">Most Recent Occurrence</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort Direction</label>
              <button
                className="sort-direction-button"
                onClick={toggleSortDirection}
              >
                {sortDirection === "asc" ? "Ascending ↑" : "Descending ↓"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && <div className="error-message">{error}</div>}

      {/* Loading State */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-animation">
            <div className="loading-circle"></div>
            <div className="loading-circle"></div>
            <div className="loading-circle"></div>
          </div>
          <p>Generating product recommendations...</p>
        </div>
      ) : (
        <>
          {/* Results Metadata */}
          {filteredRecommendations.length > 0 && (
            <div className="results-meta">
              Found {filteredRecommendations.length} product
              {filteredRecommendations.length !== 1 ? "s" : ""} with
              recommendations
              {/* Recommendation count */}
              {filteredRecommendations.reduce(
                (total, item) => total + (item.recommendations?.length || 0),
                0
              ) > 0 && (
                <span className="recommendations-count">
                  {" "}
                  with{" "}
                  {filteredRecommendations.reduce(
                    (total, item) =>
                      total + (item.recommendations?.length || 0),
                    0
                  )}{" "}
                  total recommendations
                </span>
              )}
            </div>
          )}

          {/* Recommendations Results */}
          <div className="recommendations-results">
            {filteredRecommendations.length > 0 ? (
              filteredRecommendations.map((item, productIndex) => (
                <div className="product-card" key={productIndex}>
                  <div className="product-card-header">
                    <h3>{item.product}</h3>
                  </div>

                  <div className="summary-section">
                    <h4>Recommendations Summary</h4>
                    <p>{item.summary}</p>
                  </div>

                  <div className="recommendations-section">
                    <h4>Action Items</h4>
                    {item.recommendations && item.recommendations.length > 0 ? (
                      <div className="recommendations-list">
                        {item.recommendations.map((rec, recIndex) => {
                          const isExpanded =
                            expandedRecs[`${productIndex}-${recIndex}`];

                          return (
                            <div className="recommendation-item" key={recIndex}>
                              <div className="recommendation-header">
                                <div className="recommendation-title">
                                  <h5>{rec.title}</h5>
                                  <div className="rec-badges">
                                    <span
                                      className={`badge ${getSeverityClass(
                                        rec.complexity
                                      )}`}
                                    >
                                      Complexity: {rec.complexity || "Unknown"}
                                    </span>
                                    <span
                                      className={`badge ${getSeverityClass(
                                        rec.impact
                                      )}`}
                                    >
                                      Impact: {rec.impact || "Unknown"}
                                    </span>
                                    {rec.most_recent_occurence && (
                                      <span className="badge date-badge">
                                        Last seen: {rec.most_recent_occurence}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  className="expand-button"
                                  onClick={() =>
                                    toggleRecommendation(productIndex, recIndex)
                                  }
                                >
                                  {isExpanded ? "Show Less" : "Show More"}
                                </button>
                              </div>

                              <div
                                className={`recommendation-content ${
                                  isExpanded ? "expanded" : ""
                                }`}
                              >
                                <div className="recommendation-section">
                                  <h6>Description</h6>
                                  <p className="recommendation-description">
                                    {rec.description}
                                  </p>
                                </div>

                                {rec.addresses_pain_points &&
                                  rec.addresses_pain_points.length > 0 && (
                                    <div className="recommendation-section">
                                      <h6>Addresses Pain Points</h6>
                                      <div className="pain-points-list">
                                        {rec.addresses_pain_points.map(
                                          (point, pointIndex) => (
                                            <span
                                              key={pointIndex}
                                              className="pain-point-tag"
                                            >
                                              {point}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="no-recommendations">
                        No recommendations match your current filters.
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-results">
                {recommendations.length > 0
                  ? "No recommendations match your search or filters. Try different criteria."
                  : "No recommendations available. Try generating recommendations for different products."}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Recommendations;
