// AnalysisPage.jsx
import React, { useEffect, useState } from "react";
import { fetchClaudeAnalysis, fetchAllProducts } from "@/api/api";
import "./analysisPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";
import SearchBar from "@/components/SearchBar/SearchBar";
import FilterControls from "@/components/FilterControls/FilterControls";
import LoadingState from "@/components/LoadingState/LoadingState";

const AnalysisPage = ({ productData = null }) => {
  // View state: 'list' or 'detail'
  const [view, setView] = useState(productData ? 'detail' : 'list');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Product list state
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Detail view state
  const [analysis, setAnalysis] = useState(productData);
  const [filteredAnalysis, setFilteredAnalysis] = useState(productData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sortCriteria, setSortCriteria] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [expandedPainPoints, setExpandedPainPoints] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all products (with posts, whether analyzed or not)
  const fetchProducts = async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const data = await fetchAllProducts();
      // Extract product names and filter to only show products with analysis
      const productsWithAnalysis = (data.products || [])
        .filter(p => typeof p === 'object' ? p.has_analysis : false)
        .map(p => typeof p === 'object' ? p.name : p);
      setProducts(productsWithAnalysis);
    } catch (err) {
      console.error("Error fetching products:", err);
      setProductsError("Failed to fetch products");
    } finally {
      setProductsLoading(false);
    }
  };

  // Fetch analysis for a specific product
  const fetchAnalysisForProduct = async (productName) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOpenAIAnalysis({
        product: [productName],
      });
      
      if (data.analyses && data.analyses.length > 0) {
        setAnalysis(data.analyses[0]);
        setFilteredAnalysis(data.analyses[0]);
      } else {
        setError("No analysis found for this product");
      }
    } catch (err) {
      console.error("Error fetching analysis:", err);
      setError("Failed to fetch analysis. Please check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    if (!productData) {
      fetchProducts();
    } else {
      setProductsLoading(false);
    }
  }, [productData]);

  // Filter and sort analysis based on all criteria
  useEffect(() => {
    if (!analysis) return;

    let filtered = { ...analysis };

    // Apply search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = {
        ...filtered,
        common_pain_points: filtered.common_pain_points?.filter((point) => {
          return (
            point.name?.toLowerCase().includes(term) ||
            point.description?.toLowerCase().includes(term) ||
            (point.related_keywords &&
              point.related_keywords.some((kw) =>
                kw.toLowerCase().includes(term)
              ))
          );
        }) || [],
      };
    }

    // Apply severity filter
    if (severityFilter !== "all") {
      filtered = {
        ...filtered,
        common_pain_points: filtered.common_pain_points?.filter(
          (point) => point.severity?.toLowerCase() === severityFilter
        ) || [],
      };
    }

    // Sort the pain points
    if (filtered.common_pain_points) {
      const sortedPainPoints = [...filtered.common_pain_points].sort((a, b) => {
        let valueA, valueB;

        switch (sortCriteria) {
          case "name":
            valueA = a.name?.toLowerCase() || "";
            valueB = b.name?.toLowerCase() || "";
            break;
          case "severity": {
            const severityMap = { high: 3, medium: 2, low: 1 };
            valueA = severityMap[a.severity?.toLowerCase()] || 0;
            valueB = severityMap[b.severity?.toLowerCase()] || 0;
            break;
          }
          default:
            valueA = a.name?.toLowerCase() || "";
            valueB = b.name?.toLowerCase() || "";
        }

        return sortDirection === "asc"
          ? valueA > valueB ? 1 : -1
          : valueA < valueB ? 1 : -1;
      });

      filtered.common_pain_points = sortedPainPoints;
    }

    setFilteredAnalysis(filtered);
  }, [analysis, searchTerm, severityFilter, sortCriteria, sortDirection]);

  // Handle product click
  const handleProductClick = (productName) => {
    setSelectedProduct(productName);
    setView('detail');
    fetchAnalysisForProduct(productName);
  };

  // Handle back to list
  const handleBackToList = () => {
    setView('list');
    setSelectedProduct(null);
    setAnalysis(null);
    setFilteredAnalysis(null);
    setSearchTerm("");
    setError(null);
  };

  // Toggle pain point expansion
  const togglePainPoint = (pointIndex) => {
    const key = `${pointIndex}`;
    setExpandedPainPoints((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Get severity badge class
  const getSeverityClass = (severity) => {
    switch (severity?.toLowerCase()) {
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

  // Filter products by search term
  const filteredProducts = products.filter((product) =>
    product.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render product list view
  if (view === 'list') {
    return (
      <div className="analysis-container">
        <PageHeader 
          title="Analysis"
          description="View pain points and insights from analyzed products"
        />

        {/* Search */}
        <div className="search-section">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

        {/* Error Message */}
        {productsError && <div className="error-message">{productsError}</div>}

        {/* Loading State */}
        {productsLoading ? (
          <LoadingState />
        ) : (
          <>
            {/* Products List */}
            <div className="products-list-container">
              {filteredProducts.length > 0 ? (
                <>
                  <div className="products-count">
                    {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} analyzed
                  </div>
                  <div className="products-grid">
                    {filteredProducts.map((product, index) => (
                      <div
                        key={index}
                        className="product-card"
                        onClick={() => handleProductClick(product)}
                      >
                        <h3>{product}</h3>
                        <p>Click to view analysis</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="no-results">
                  {products.length === 0
                    ? "No products have been analyzed yet. Start scraping to generate analysis."
                    : "No products match your search."}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Render detail view
  return (
    <div className="analysis-container">
      <PageHeader 
        title={selectedProduct ? `Analysis: ${selectedProduct}` : "Analysis"}
        description="Detailed pain points and insights"
      />

      <button onClick={handleBackToList} className="back-button">
        ← Back to Products
      </button>

      {/* Search */}
      <div className="search-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search in pain points..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <div className="search-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Advanced Filters Button */}
      <div className="filters-button-container">
        <button className="toggle-filters-button" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? "Hide Advanced Filters" : "Show Advanced Filters"}
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="advanced-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label>Severity Filter</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={sortCriteria}
                onChange={(e) => setSortCriteria(e.target.value)}
                className="filter-select"
              >
                <option value="name">Pain Point Name</option>
                <option value="severity">Severity</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort Direction</label>
              <button
                className="sort-direction-button"
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
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
        <LoadingState />
      ) : filteredAnalysis ? (
        <>
          {/* Results Metadata */}
          {filteredAnalysis.common_pain_points?.length > 0 && (
            <div className="results-meta">
              Found {filteredAnalysis.common_pain_points.length} pain point
              {filteredAnalysis.common_pain_points.length !== 1 ? "s" : ""}
            </div>
          )}

          {/* Analysis Results */}
          <div className="analysis-results">
            <div className="analysis-card">
              <div className="analysis-card-header">
                <h3>{filteredAnalysis.product || selectedProduct}</h3>
              </div>

              <div className="analysis-summary">
                <h4>Analysis Summary</h4>
                <p>{filteredAnalysis.analysis_summary || "No summary available"}</p>
              </div>

              <div className="pain-points-section">
                <h4>Common Pain Points</h4>
                {filteredAnalysis.common_pain_points?.length > 0 ? (
                  <div className="pain-points-list">
                    {filteredAnalysis.common_pain_points.map((point, pointIndex) => {
                      const isExpanded = expandedPainPoints[`${pointIndex}`];

                      return (
                        <div className="pain-point-item" key={pointIndex}>
                          <div className="pain-point-header">
                            <div className="pain-point-title">
                              <h5>{point.name}</h5>
                              <span
                                className={`severity-badge ${getSeverityClass(
                                  point.severity
                                )}`}
                              >
                                {point.severity || "Unknown"}
                              </span>
                            </div>
                            <button
                              className="expand-button"
                              onClick={() => togglePainPoint(pointIndex)}
                            >
                              {isExpanded ? "Show Less" : "Show More"}
                            </button>
                          </div>

                          <div
                            className={`pain-point-content ${
                              isExpanded ? "expanded" : ""
                            }`}
                          >
                            <div className="pain-point-section">
                              <h6>Description</h6>
                              <p className="pain-point-description">
                                {point.description}
                              </p>
                            </div>

                            {point.potential_solutions && (
                              <div className="pain-point-section">
                                <h6>Potential Solutions</h6>
                                <p className="pain-point-solutions">
                                  {point.potential_solutions}
                                </p>
                              </div>
                            )}

                            {point.related_keywords &&
                              point.related_keywords.length > 0 && (
                                <div className="pain-point-section">
                                  <h6>Related Keywords</h6>
                                  <div className="keywords-list">
                                    {point.related_keywords.map(
                                      (keyword, keywordIndex) => (
                                        <span
                                          key={keywordIndex}
                                          className="keyword-tag"
                                        >
                                          {keyword}
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
                  <div className="no-pain-points">
                    No pain points match your current filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="no-results">
          No analysis available for this product.
        </div>
      )}
    </div>
  );
};

export default AnalysisPage;
