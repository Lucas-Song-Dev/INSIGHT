import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Lightbulb, BarChart3 } from "lucide-react";
import { fetchClaudeAnalysis, fetchSavedRecommendations, runAnalysis, generateRecommendations, fetchJobDetails } from "@/api/api";
import { useNotification } from "@/context/NotificationContext";
import AnalysisPage from "@/pages/analysisPage/AnalysisPage";
import RecomendationPage from "@/pages/recommendationPage/RecomendationPage";
import JobCard from "@/components/JobCard/JobCard";
import ConfirmModal from "@/components/ConfirmModal/ConfirmModal";
import "./productDetailPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";

const ProductDetailPage = () => {
  const { productName } = useParams();
  const navigate = useNavigate();
  const selectedProduct = decodeURIComponent(productName);
  const [activeTab, setActiveTab] = useState("analysis"); // Default to analysis, removed discussions tab
  const [productData, setProductData] = useState({
    posts: null,
    analysis: null,
    recommendations: null,
  });
  const [recommendationType, setRecommendationType] = useState("improve_product");
  const [recommendationsByType, setRecommendationsByType] = useState({
    improve_product: null,
    new_feature: null,
    competing_product: null,
  });
  const [recContext, setRecContext] = useState("");
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);
  const [analysisOptions, setAnalysisOptions] = useState({ max_posts: 500, skip_recommendations: false });
  const [currentAnalysisJobId, setCurrentAnalysisJobId] = useState(null);
  const [analysisJob, setAnalysisJob] = useState(null);
  const [currentRecommendationsJobIdByType, setCurrentRecommendationsJobIdByType] = useState({
    improve_product: null,
    new_feature: null,
    competing_product: null,
  });
  const [recommendationsJobByType, setRecommendationsJobByType] = useState({
    improve_product: null,
    new_feature: null,
    competing_product: null,
  });
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showRegenerateRecModal, setShowRegenerateRecModal] = useState(false);
  const [regenerateRecContext, setRegenerateRecContext] = useState("");
  const { showNotification } = useNotification();

  const REC_TYPES = [
    { value: "improve_product", label: "Improve the product" },
    { value: "new_feature", label: "Create a new feature" },
    { value: "competing_product", label: "Create a competing product" },
  ];

  // Single source of truth per tab: current tab's recommendations (not shared across types)
  const currentRecommendations = recommendationsByType[recommendationType];

  const fetchAnalysisJob = useCallback(async (jobId) => {
    try {
      const data = await fetchJobDetails(jobId);
      setAnalysisJob(data.job);
      if (data.job?.status === "completed") {
        const analysisData = await fetchClaudeAnalysis({ product: [selectedProduct] });
        if (analysisData.analyses?.length > 0) {
          const doc = analysisData.analyses[0];
          const payload = doc.analysis && typeof doc.analysis === "object"
            ? { ...doc.analysis, product: doc.product ?? doc.analysis.product }
            : doc;
          setProductData((prev) => ({ ...prev, analysis: payload }));
        }
      }
    } catch (err) {
      console.error("Error fetching analysis job:", err);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (selectedProduct) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  useEffect(() => {
    if (!currentAnalysisJobId) {
      setAnalysisJob(null);
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      fetchAnalysisJob(currentAnalysisJobId);
    };
    tick();
    const interval = setInterval(tick, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentAnalysisJobId, fetchAnalysisJob]);

  const fetchRecommendationsForType = useCallback(async (type) => {
    if (!selectedProduct) return null;
    try {
      const recData = await fetchSavedRecommendations({
        products: [selectedProduct],
        recommendationType: type,
      });
      if (recData.recommendations && recData.recommendations.length > 0) {
        return recData.recommendations[0];
      }
    } catch (err) {
      console.error("Error fetching recommendations for type:", type, err);
    }
    return null;
  }, [selectedProduct]);

  const fetchRecommendationsJob = useCallback(async (jobId) => {
    try {
      const data = await fetchJobDetails(jobId);
      const job = data.job;
      const typeFromJob = (job?.parameters?.recommendation_type || "improve_product").trim().toLowerCase();
      const validType = ["improve_product", "new_feature", "competing_product"].includes(typeFromJob) ? typeFromJob : "improve_product";

      setRecommendationsJobByType((prev) => ({ ...prev, [validType]: job }));

      const status = job?.status;
      if (status === "completed") {
        const doc = await fetchRecommendationsForType(validType);
        if (doc) {
          setRecommendationsByType((prev) => ({ ...prev, [validType]: doc }));
          showNotification("Recommendations generated successfully!", "success");
        }
        setCurrentRecommendationsJobIdByType((prev) => ({ ...prev, [validType]: null }));
        setRecommendationsJobByType((prev) => ({ ...prev, [validType]: null }));
      } else if (status === "failed" || status === "cancelled") {
        showNotification(job?.error || "Recommendations job failed", "error");
        setCurrentRecommendationsJobIdByType((prev) => ({ ...prev, [validType]: null }));
        setRecommendationsJobByType((prev) => ({ ...prev, [validType]: null }));
      }
    } catch (err) {
      console.error("Error fetching recommendations job:", err);
    }
  }, [fetchRecommendationsForType, showNotification]);

  const recommendationJobIds = Object.entries(currentRecommendationsJobIdByType).filter(([, id]) => id);
  useEffect(() => {
    if (recommendationJobIds.length === 0) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      recommendationJobIds.forEach(([, jobId]) => fetchRecommendationsJob(jobId));
    };
    tick();
    const interval = setInterval(tick, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentRecommendationsJobIdByType.improve_product, currentRecommendationsJobIdByType.new_feature, currentRecommendationsJobIdByType.competing_product, fetchRecommendationsJob]);

  const fetchAllData = async () => {
    // REMOVED: Posts fetching - Discussions tab removed per user request
    
    // Fetch analysis
    try {
      const analysisData = await fetchClaudeAnalysis({ product: [selectedProduct] });
      if (analysisData.analyses && analysisData.analyses.length > 0) {
        const doc = analysisData.analyses[0];
        // API returns { _id, product, analysis: { common_pain_points, analysis_summary, ... } }; normalize for UI
        const payload = doc.analysis && typeof doc.analysis === "object"
          ? { ...doc.analysis, product: doc.product ?? doc.analysis.product }
          : doc;
        setProductData((prev) => ({ ...prev, analysis: payload }));
      }
    } catch (err) {
      console.error("Error fetching analysis:", err);
    }

    // Fetch recommendations for all three types so each tab has its own data
    const typesToFetch = ["improve_product", "new_feature", "competing_product"];
    try {
      const results = await Promise.all(
        typesToFetch.map(async (type) => {
          const recData = await fetchSavedRecommendations({
            products: [selectedProduct],
            recommendationType: type,
          });
          const doc =
            recData.recommendations && recData.recommendations.length > 0
              ? recData.recommendations[0]
              : null;
          return { type, doc };
        })
      );
      setRecommendationsByType((prev) => {
        const next = { ...prev };
        results.forEach(({ type, doc }) => {
          next[type] = doc;
        });
        return next;
      });
      // Keep productData.recommendations in sync with default type for badge/backward compat
      const defaultDoc = results.find((r) => r.type === "improve_product")?.doc ?? null;
      setProductData((prev) => ({ ...prev, recommendations: defaultDoc }));
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    }
  };

  const handleRecommendationTypeChange = async (type) => {
    setRecommendationType(type);
    // Always fetch from the backend for this type so we show the correct doc (improve vs new_feature vs competing_product)
    const doc = await fetchRecommendationsForType(type);
    setRecommendationsByType((prev) => ({ ...prev, [type]: doc }));
  };

  const handleBack = () => {
    navigate("/results");
  };

  const handleRunAnalysis = async (opts = {}) => {
    if (!selectedProduct) return;
    const { regenerate = false } = opts;

    setIsRunningAnalysis(true);
    if (regenerate) {
      setShowRegenerateConfirm(false);
      setProductData((prev) => ({ ...prev, analysis: null }));
      setCurrentAnalysisJobId(null);
      setAnalysisJob(null);
    }
    try {
      showNotification(
        regenerate ? `Regenerating analysis for ${selectedProduct}...` : `Running analysis for ${selectedProduct}...`,
        "info"
      );
      const result = await runAnalysis({
        product: selectedProduct,
        max_posts: analysisOptions.max_posts,
        skip_recommendations: analysisOptions.skip_recommendations,
        regenerate,
      });

      if (result.status === "success") {
        if (result.job_id) {
          setCurrentAnalysisJobId(result.job_id);
          showNotification(
            regenerate
              ? "Regeneration started. Analysis will update when the job completes."
              : "Analysis job started. View status below or open the job for details.",
            "success"
          );
        } else {
          showNotification(`Analysis completed! Found ${result.pain_points_count || 0} pain points.`, "success");
        }
        setActiveTab("analysis");
        if (!result.job_id) {
          const analysisData = await fetchClaudeAnalysis({ product: [selectedProduct] });
          if (analysisData.analyses && analysisData.analyses.length > 0) {
            const doc = analysisData.analyses[0];
            const payload =
              doc.analysis && typeof doc.analysis === "object"
                ? { ...doc.analysis, product: doc.product ?? doc.analysis.product }
                : doc;
            setProductData((prev) => ({ ...prev, analysis: payload }));
          }
        }
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

  const handleRegenerateConfirm = () => {
    handleRunAnalysis({ regenerate: true });
  };

  const handleJobCardClick = (jobId) => {
    navigate(`/jobs/${jobId}`, { state: { from: "product-analysis", productName: selectedProduct } });
  };

  const handleGenerateRecommendations = async (opts = {}) => {
    if (!selectedProduct) return;

    const hasExisting = opts.regenerate ?? !!recommendationsByType[recommendationType];
    const contextValue = opts.context !== undefined ? opts.context : recContext;
    setIsGeneratingRecs(true);
    try {
      showNotification(
        hasExisting ? `Starting regeneration...` : `Starting recommendations for ${selectedProduct}...`,
        "info"
      );
      const result = await generateRecommendations({
        products: [selectedProduct],
        recommendationType,
        context: (typeof contextValue === "string" ? contextValue.trim() : "") || undefined,
        regenerate: hasExisting,
      });

      if (result.status === "success" && result.job_id) {
        showNotification("Recommendations job started. View status below or open the job for details.", "success");
        setRecommendationsByType((prev) => ({ ...prev, [recommendationType]: null }));
        setCurrentRecommendationsJobIdByType((prev) => ({ ...prev, [recommendationType]: result.job_id }));
        setRecommendationsJobByType((prev) => ({ ...prev, [recommendationType]: null }));
        setActiveTab("recommendations");
      } else if (result.status === "success") {
        showNotification("Recommendations generated successfully!", "success");
        const doc =
          result.recommendations && result.recommendations.length > 0
            ? result.recommendations[0]
            : await fetchRecommendationsForType(recommendationType);
        if (doc) {
          setRecommendationsByType((prev) => ({ ...prev, [recommendationType]: doc }));
        }
        setActiveTab("recommendations");
      } else {
        showNotification(result.message || "Failed to generate recommendations", "error");
      }
    } catch (err) {
      console.error("Error generating recommendations:", err);
      const msg = err.response?.data?.message || err.message || "Failed to generate recommendations";
      showNotification(msg, "error");
    } finally {
      setIsGeneratingRecs(false);
    }
  };

  const handleRegenerateRecConfirm = () => {
    handleGenerateRecommendations({ context: regenerateRecContext, regenerate: true });
    setShowRegenerateRecModal(false);
    setRegenerateRecContext("");
  };

  return (
    <div className="product-detail-page">
      <div className="product-detail-title-block">
        <div className="product-header">
          <button onClick={handleBack} className="back-button">
            <ArrowLeft size={18} aria-hidden />
            Back to Results
          </button>
          <PageHeader title={selectedProduct} />
        </div>

        {/* Tabs Navigation - REMOVED Discussions tab per user request */}
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === "analysis" ? "active" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            <BarChart3 size={16} aria-hidden style={{ marginRight: "8px" }} />
            Analysis
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
            <Lightbulb size={16} aria-hidden style={{ marginRight: "8px" }} />
            Recommendations
            {currentRecommendations?.recommendations?.length > 0 && (
              <span className="tab-badge">
                {currentRecommendations.recommendations.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "recommendations" && (
          <div className="rec-type-tabs" role="tablist" aria-label="Recommendation type">
            {REC_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={recommendationType === value}
                className={`rec-type-tab ${recommendationType === value ? "active" : ""}`}
                onClick={() => handleRecommendationTypeChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "analysis" && (
          <div className="analysis-tab">
            {productData.analysis ? (
              <>
                <AnalysisPage
                  productData={productData.analysis}
                  embedded
                  onRegenerate={() => setShowRegenerateConfirm(true)}
                  isRegenerating={isRunningAnalysis}
                />
                <ConfirmModal
                  isOpen={showRegenerateConfirm}
                  title="Regenerate analysis?"
                  confirmLabel="Regenerate"
                  cancelLabel="Cancel"
                  onConfirm={handleRegenerateConfirm}
                  onCancel={() => setShowRegenerateConfirm(false)}
                >
                  <p>This will clear the current analysis and run a new one. It costs <strong>1 credit</strong>. Continue?</p>
                </ConfirmModal>
              </>
            ) : currentAnalysisJobId && (analysisJob || isRunningAnalysis) ? (
              <div className="analysis-job-section">
                <div className="analysis-job-card">
                  {analysisJob ? (
                    <JobCard
                      job={analysisJob}
                      onClick={handleJobCardClick}
                      showCancel={false}
                    />
                  ) : (
                    <div className="analysis-job-loading">
                      <p>Loading job status...</p>
                    </div>
                  )}
                </div>
                <p className="analysis-job-section-hint">Click the job card to view details and logs. Results will appear here when the job completes.</p>
                <div className="analysis-options">
                  <label>
                    Max posts to analyze (1–1000):
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={analysisOptions.max_posts}
                      onChange={(e) => setAnalysisOptions((o) => ({ ...o, max_posts: Math.min(1000, Math.max(1, Number(e.target.value) || 500)) }))}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={analysisOptions.skip_recommendations}
                      onChange={(e) => setAnalysisOptions((o) => ({ ...o, skip_recommendations: e.target.checked }))}
                    />
                    Skip recommendations (pain points only)
                  </label>
                </div>
                <button
                  onClick={handleRunAnalysis}
                  disabled={isRunningAnalysis}
                  className="action-button secondary"
                >
                  {isRunningAnalysis ? "Running Analysis..." : "Run analysis again"}
                </button>
              </div>
            ) : (
              <div className="no-data">
                <p>No analysis available for this product.</p>
                <p className="hint">Click "Run Analysis" to generate analysis from existing posts.</p>
                <div className="analysis-options">
                  <label>
                    Max posts to analyze (1–1000):
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={analysisOptions.max_posts}
                      onChange={(e) => setAnalysisOptions((o) => ({ ...o, max_posts: Math.min(1000, Math.max(1, Number(e.target.value) || 500)) }))}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={analysisOptions.skip_recommendations}
                      onChange={(e) => setAnalysisOptions((o) => ({ ...o, skip_recommendations: e.target.checked }))}
                    />
                    Skip recommendations (pain points only)
                  </label>
                </div>
                <button
                  onClick={handleRunAnalysis}
                  disabled={isRunningAnalysis}
                  className="action-button"
                >
                  {isRunningAnalysis ? "Running Analysis..." : "Run Analysis"}
                </button>
              </div>
            )}
          </div>
        )}
        {activeTab === "recommendations" && (
          <div className="recommendations-tab" key={recommendationType}>
            {currentRecommendationsJobIdByType[recommendationType] ? (
              <div className="analysis-job-section">
                <div className="analysis-job-card">
                  {recommendationsJobByType[recommendationType] ? (
                    <JobCard
                      job={recommendationsJobByType[recommendationType]}
                      onClick={handleJobCardClick}
                      showCancel={false}
                    />
                  ) : (
                    <div className="analysis-job-loading">
                      <p>Loading job status...</p>
                    </div>
                  )}
                </div>
                <p className="analysis-job-section-hint">
                  Click the job card to view details and logs. Recommendations will appear here when the job completes.
                </p>
                <button
                  onClick={() => handleGenerateRecommendations()}
                  disabled={isGeneratingRecs}
                  className="action-button secondary"
                >
                  {isGeneratingRecs ? "Starting…" : "Generate recommendations again"}
                </button>
              </div>
            ) : currentRecommendations ? (
              <>
                <ConfirmModal
                  isOpen={showRegenerateRecModal}
                  title="Regenerate recommendations?"
                  confirmLabel="Regenerate"
                  cancelLabel="Cancel"
                  onConfirm={handleRegenerateRecConfirm}
                  onCancel={() => { setShowRegenerateRecModal(false); setRegenerateRecContext(""); }}
                >
                  <p>This costs 1 credit. You can add optional direction below.</p>
                  <div className="rec-context-wrap">
                    <label htmlFor="regenerate-rec-context">Optional direction (max 500 chars)</label>
                    <textarea
                      id="regenerate-rec-context"
                      className="rec-context-input"
                      placeholder="e.g. Focus on mobile users, or prioritize speed..."
                      value={regenerateRecContext}
                      onChange={(e) => setRegenerateRecContext(e.target.value.slice(0, 500))}
                      maxLength={500}
                      rows={3}
                    />
                    {regenerateRecContext.length > 0 && (
                      <span className="rec-context-count">{regenerateRecContext.length}/500</span>
                    )}
                  </div>
                </ConfirmModal>
                <RecomendationPage
                  productData={currentRecommendations}
                  embedded
                  onRegenerate={() => setShowRegenerateRecModal(true)}
                  isRegenerating={isGeneratingRecs}
                />
              </>
            ) : (
              <div className="no-data">
                <p>No recommendations for this type yet.</p>
                <p className="hint">
                  {productData.analysis
                    ? "First time: 2 credits. Add optional direction below, then generate."
                    : "Run analysis first to generate pain points, then generate recommendations."}
                </p>
                <div className="rec-context-wrap">
                  <label htmlFor="rec-context-empty">Optional direction (max 500 chars)</label>
                  <textarea
                    id="rec-context-empty"
                    className="rec-context-input"
                    placeholder="e.g. Focus on mobile users..."
                    value={recContext}
                    onChange={(e) => setRecContext(e.target.value.slice(0, 500))}
                    maxLength={500}
                    rows={2}
                  />
                  {recContext.length > 0 && (
                    <span className="rec-context-count">{recContext.length}/500</span>
                  )}
                </div>
                <button
                  onClick={handleGenerateRecommendations}
                  disabled={isGeneratingRecs || !productData.analysis}
                  className="action-button"
                >
                  {isGeneratingRecs ? "Starting…" : "Generate Recommendations (2 credits)"}
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

