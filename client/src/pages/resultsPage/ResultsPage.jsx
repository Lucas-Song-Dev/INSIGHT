import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllProducts } from "@/api/api";
import "./resultsPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";
import LoadingState from "@/components/LoadingState/LoadingState";

const ResultsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all products (with posts, whether analyzed or not)
  const fetchProducts = async () => {
    console.log('[RESULTS PAGE] ========== FETCH PRODUCTS CALLED ==========');
    console.log('[RESULTS PAGE] Step 1: Setting loading state to true');
    setLoading(true);
    setError(null);
    
    try {
      console.log('[RESULTS PAGE] Step 2: Calling fetchAllProducts API...');
      const data = await fetchAllProducts();
      console.log('[RESULTS PAGE] Step 3: API response received:', {
        hasData: !!data,
        status: data?.status,
        productsCount: data?.products?.length || 0,
        products: data?.products || []
      });
      
      const productsList = data.products || [];
      console.log('[RESULTS PAGE] Step 4: Setting products state:', {
        count: productsList.length,
        products: productsList.map(p => typeof p === 'string' ? p : p.name)
      });
      setProducts(productsList);
      console.log('[RESULTS PAGE] ========== FETCH PRODUCTS SUCCESS ==========');
    } catch (err) {
      console.error('[RESULTS PAGE] ========== FETCH PRODUCTS ERROR ==========');
      console.error('[RESULTS PAGE] Error type:', err.constructor.name);
      console.error('[RESULTS PAGE] Error message:', err.message);
      console.error('[RESULTS PAGE] Error details:', {
        message: err.message,
        responseStatus: err.response?.status,
        responseStatusText: err.response?.statusText,
        responseData: err.response?.data,
        hasResponse: !!err.response,
        stack: err.stack?.split('\n').slice(0, 5).join('\n')
      });
      
      // Provide more specific error messages
      let errorMessage = "Failed to fetch products";
      if (err.response?.status === 401 || err.response?.status === 403) {
        errorMessage = "Authentication required. Please log in again.";
        console.error('[RESULTS PAGE] Authentication error - user may need to re-login');
      } else if (err.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
        console.error('[RESULTS PAGE] Server error occurred');
      } else if (err.message?.includes('Network Error') || err.message?.includes('CORS')) {
        errorMessage = "Network error. Please check your connection and try again.";
        console.error('[RESULTS PAGE] Network/CORS error - check server connection');
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      console.error('[RESULTS PAGE] Setting error message:', errorMessage);
      setError(errorMessage);
      console.error('[RESULTS PAGE] ========== FETCH PRODUCTS ERROR HANDLED ==========');
    } finally {
      console.log('[RESULTS PAGE] Step 5: Setting loading state to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[RESULTS PAGE] ========== COMPONENT MOUNTED ==========');
    console.log('[RESULTS PAGE] useEffect triggered - fetching products on mount');
    fetchProducts();
  }, []);

  // Filter products by search term
  const filteredProducts = products.filter((product) => {
    const productName = (product.name || product).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matches = productName.includes(searchLower);
    if (searchTerm && matches) {
      console.log('[RESULTS PAGE] Product matches search:', productName);
    }
    return matches;
  });
  
  // Log filtering results
  useEffect(() => {
    if (searchTerm) {
      console.log('[RESULTS PAGE] Search filter applied:', {
        searchTerm,
        totalProducts: products.length,
        filteredCount: filteredProducts.length
      });
    }
  }, [searchTerm, products.length, filteredProducts.length]);

  const handleProductClick = (product) => {
    const productName = typeof product === 'string' ? product : product.name;
    console.log('[RESULTS PAGE] Product clicked:', productName);
    console.log('[RESULTS PAGE] Navigating to product detail page');
    navigate(`/products/${encodeURIComponent(productName)}`);
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

