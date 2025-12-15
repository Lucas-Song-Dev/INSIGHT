import React, { useState, useEffect } from "react";
import { fetchPosts, fetchOpenAIAnalysis, fetchSavedRecommendations, runAnalysis, generateRecommendations } from "@/api/api";
import { useNotification } from "@/context/NotificationContext";
import PostsPage from "@/pages/postsPage/PostsPage";
import AnalysisPage from "@/pages/analysisPage/AnalysisPage";
import RecomendationPage from "@/pages/recommendationPage/RecomendationPage";
import "./productDetailPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";

const ProductDetailPage = ({ selectedProduct, setActivePage }) => {
  const [activeTab, setActiveTab] = useState("posts");
  const [productData, setProductData] = useState({
    posts: null,
    analysis: null,
    recommendations: null,
  });
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    // Fetch data when component mounts or product changes
    if (selectedProduct) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  const fetchAllData = async () => {
    // Fetch posts
    try {
      const postsData = await fetchPosts({ product: selectedProduct, limit: 100 });
      setProductData((prev) => ({ ...prev, posts: postsData.posts || [] }));
    } catch (err) {
      console.error("Error fetching posts:", err);
    }

    // Fetch analysis
    try {
      const analysisData = await fetchOpenAIAnalysis({ product: [selectedProduct] });
      if (analysisData.analyses && analysisData.analyses.length > 0) {
        setProductData((prev) => ({ ...prev, analysis: analysisData.analyses[0] }));
      }
    } catch (err) {
      console.error("Error fetching analysis:", err);
    }

    // Fetch recommendations
    try {
      const recData = await fetchSavedRecommendations({ products: [selectedProduct] });
      if (recData.recommendations && recData.recommendations.length > 0) {
        setProductData((prev) => ({ ...prev, recommendations: recData.recommendations[0] }));
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    }
  };

  const handleBack = () => {
    setActivePage("results");
  };

  const handleRunAnalysis = async () => {
    if (!selectedProduct) return;
    
    setIsRunningAnalysis(true);
    try {
      showNotification(`Running analysis for ${selectedProduct}...`, "info");
      const result = await runAnalysis({ product: selectedProduct });
      
      if (result.status === "success") {
        showNotification(`Analysis completed! Found ${result.pain_points_count || 0} pain points.`, "success");
        // Refresh analysis data
        const analysisData = await fetchOpenAIAnalysis({ product: [selectedProduct] });
        if (analysisData.analyses && analysisData.analyses.length > 0) {
          setProductData((prev) => ({ ...prev, analysis: analysisData.analyses[0] }));
        }
        // Switch to analysis tab to show results
        setActiveTab("analysis");
      } else {
        showNotification(result.message || "Analysis failed", "error");
      }
    } catch (err) {
      console.error("Error running analysis:", err);
      showNotification(err.message || "Failed to run analysis", "error");
    } finally {
      setIsRunningAnalysis(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    if (!selectedProduct) return;
    
    setIsGeneratingRecs(true);
    try {
      showNotification(`Generating recommendations for ${selectedProduct}...`, "info");
      const result = await generateRecommendations({ products: [selectedProduct] });
      
      if (result.status === "success") {
        showNotification("Recommendations generated successfully!", "success");
        // Refresh recommendations data
        const recData = await fetchSavedRecommendations({ products: [selectedProduct] });
        if (recData.recommendations && recData.recommendations.length > 0) {
          setProductData((prev) => ({ ...prev, recommendations: recData.recommendations[0] }));
        }
        // Switch to recommendations tab to show results
        setActiveTab("recommendations");
      } else {
        showNotification(result.message || "Failed to generate recommendations", "error");
      }
    } catch (err) {
      console.error("Error generating recommendations:", err);
      showNotification(err.message || "Failed to generate recommendations", "error");
    } finally {
      setIsGeneratingRecs(false);
    }
  };

  return (
    <div className="product-detail-page">
      <div className="product-header">
        <button onClick={handleBack} className="back-button">
          ← Back to Results
        </button>
        <PageHeader 
          title={selectedProduct}
          description="Discover insights, analysis, and recommendations for this topic"
        />
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === "posts" ? "active" : ""}`}
          onClick={() => setActiveTab("posts")}
        >
          💬 Discussions
          {productData.posts && (
            <span className="tab-badge">{productData.posts.length}</span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === "analysis" ? "active" : ""}`}
          onClick={() => setActiveTab("analysis")}
        >
          📊 Analysis
          {productData.analysis && (
            <span className="tab-badge">
              {productData.analysis.common_pain_points?.length || 0}
            </span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === "recommendations" ? "active" : ""}`}
          onClick={() => setActiveTab("recommendations")}
        >
          💡 Recommendations
          {productData.recommendations && (
            <span className="tab-badge">
              {productData.recommendations.recommendations?.length || 0}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "posts" && (
          <div className="posts-tab">
            <PostsPage productFilter={selectedProduct} />
          </div>
        )}
        {activeTab === "analysis" && (
          <div className="analysis-tab">
            {productData.analysis ? (
              <AnalysisPage productData={productData.analysis} />
            ) : (
              <div className="no-data">
                <p>No analysis available for this product.</p>
                <p className="hint">Click "Run Analysis" to generate analysis from existing posts.</p>
                <button
                  onClick={handleRunAnalysis}
                  disabled={isRunningAnalysis || !productData.posts || productData.posts.length === 0}
                  className="action-button"
                >
                  {isRunningAnalysis ? "Running Analysis..." : "Run Analysis"}
                </button>
              </div>
            )}
          </div>
        )}
        {activeTab === "recommendations" && (
          <div className="recommendations-tab">
            {productData.recommendations ? (
              <RecomendationPage productData={productData.recommendations} />
            ) : (
              <div className="no-data">
                <p>No recommendations available for this product.</p>
                <p className="hint">
                  {productData.analysis 
                    ? "Click 'Generate Recommendations' to create recommendations based on the analysis."
                    : "Run analysis first, then generate recommendations."}
                </p>
                <button
                  onClick={handleGenerateRecommendations}
                  disabled={isGeneratingRecs || !productData.analysis}
                  className="action-button"
                >
                  {isGeneratingRecs ? "Generating..." : "Generate Recommendations"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;

