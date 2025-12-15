import React, { useEffect, useState } from "react";
import { fetchAllProducts } from "@/api/api";
import "./resultsPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";
import LoadingState from "@/components/LoadingState/LoadingState";

const ResultsPage = ({ setActivePage, setSelectedProduct }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all products (with posts, whether analyzed or not)
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllProducts();
      setProducts(data.products || []);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filter products by search term
  const filteredProducts = products.filter((product) =>
    (product.name || product).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleProductClick = (product) => {
    const productName = typeof product === 'string' ? product : product.name;
    setSelectedProduct(productName);
    setActivePage("productDetail");
  };

  return (
    <div className="results-page">
      <PageHeader 
        title="Results"
        description="View all analyzed products and their insights"
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
      {error && <div className="error-message">{error}</div>}

      {/* Loading State */}
      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* Products List */}
          <div className="products-list-container">
            {filteredProducts.length > 0 ? (
              <>
                <div className="products-count">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} with posts
                </div>
                <div className="products-grid">
                  {filteredProducts.map((product, index) => {
                    const productName = typeof product === 'string' ? product : product.name;
                    const hasAnalysis = typeof product === 'object' ? product.has_analysis : false;
                    const hasRecommendations = typeof product === 'object' ? product.has_recommendations : false;
                    return (
                      <div
                        key={index}
                        className="product-card"
                        onClick={() => handleProductClick(product)}
                      >
                        <h3>{productName}</h3>
                        <p>Click to view details</p>
                        <div className="product-actions">
                          <span className="action-badge">📝 Posts</span>
                          {hasAnalysis ? (
                            <span className="action-badge success">✓ Analysis</span>
                          ) : (
                            <span className="action-badge pending">⏳ Analysis</span>
                          )}
                          {hasRecommendations ? (
                            <span className="action-badge success">✓ Recommendations</span>
                          ) : (
                            <span className="action-badge pending">⏳ Recommendations</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="no-results">
                {products.length === 0
                  ? "No products have posts yet. Start scraping to collect posts."
                  : "No products match your search."}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ResultsPage;

