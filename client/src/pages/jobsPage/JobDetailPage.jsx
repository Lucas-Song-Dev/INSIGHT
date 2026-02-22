import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { fetchJobDetails } from "@/api/api";
import { subscribeJobLogs, unsubscribeJobLogs } from "@/api/socket.js";
import "./jobDetailPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";
import LoadingState from "@/components/LoadingState/LoadingState";

const JobDetailPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const location = useLocation();
  const [job, setJob] = useState(null);
  const fromProductAnalysis = location.state?.from === "product-analysis" && location.state?.productName;
  const productName = location.state?.productName;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJob = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await fetchJobDetails(jobId);
        setJob(data.job);
      } catch (err) {
        console.error("Error fetching job details:", err);
        if (err.response?.status === 404) {
          setError("Job not found");
        } else if (err.response?.status === 403) {
          setError("You don't have permission to view this job");
        } else {
          setError(err.message || "Failed to fetch job details");
        }
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  // Real-time pipeline logs via WebSocket
  useEffect(() => {
    if (!jobId) return;
    subscribeJobLogs(jobId, (log) => {
      setJob((prev) =>
        prev ? { ...prev, logs: [...(prev.logs || []), log] } : prev
      );
    });
    return () => unsubscribeJobLogs(jobId);
  }, [jobId]);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "pending":
        return "status-badge pending";
      case "in_progress":
        return "status-badge in-progress";
      case "completed":
        return "status-badge completed";
      case "failed":
        return "status-badge failed";
      default:
        return "status-badge";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const calculateDuration = (startedAt, completedAt) => {
    if (!startedAt || !completedAt) return null;
    try {
      const start = new Date(startedAt);
      const end = new Date(completedAt);
      const diffMs = end - start;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      if (diffMins > 0) {
        return `${diffMins}m ${diffSecs}s`;
      }
      return `${diffSecs}s`;
    } catch {
      return null;
    }
  };

  const handleViewResults = () => {
    if (job?.results?.products_found && job.results.products_found.length > 0) {
      // Navigate to results page - could filter by products if needed
      navigate("/results");
    }
  };

  if (loading) {
    return (
      <div className="job-detail-page">
        <PageHeader title="Job Details" description="Loading job information..." />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="job-detail-page">
        <PageHeader title="Job Details" description="Error loading job" />
        <div className="error-message">
          {error}
        </div>
        <button className="back-button" onClick={() => navigate("/jobs")}>
          <ArrowLeft size={18} aria-hidden />
          Back to Jobs
        </button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="job-detail-page">
        <PageHeader title="Job Details" description="Job not found" />
        <button className="back-button" onClick={() => navigate("/jobs")}>
          <ArrowLeft size={18} aria-hidden />
          Back to Jobs
        </button>
      </div>
    );
  }

  const duration = calculateDuration(job.started_at, job.completed_at);

  const jobTitle = (() => {
    if (!job?.parameters) return "N/A";
    if (job.parameters.type === "analysis" && job.parameters.product) {
      return `Analysis: ${job.parameters.product}`;
    }
    if (job.parameters.type === "recommendations" && job.parameters.product) {
      const typeLabel =
        job.parameters.recommendation_type === "new_feature"
          ? "New feature"
          : job.parameters.recommendation_type === "competing_product"
            ? "Competing product"
            : "Improve product";
      return `Recommendations (${typeLabel}): ${job.parameters.product}`;
    }
    return job.parameters.topic || "N/A";
  })();

  return (
    <div className="job-detail-page">
      <PageHeader 
        title="Job Details"
        description={`Job: ${jobTitle}`}
      />

      {fromProductAnalysis && productName && (
        <div className="job-detail-breadcrumb">
          <button
            type="button"
            className="breadcrumb-link"
            onClick={() => navigate("/results")}
          >
            Results
          </button>
          <span className="breadcrumb-sep">›</span>
          <button
            type="button"
            className="breadcrumb-link"
            onClick={() => navigate(`/products/${encodeURIComponent(productName)}`)}
          >
            {productName}
          </button>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">Analysis</span>
        </div>
      )}

      <button className="back-button" onClick={() => navigate("/jobs")}>
        <ArrowLeft size={18} aria-hidden />
        Back to Jobs
      </button>

      <div className="job-detail-container">
        {/* Status Section */}
        <div className="detail-section">
          <h2 className="section-title">Status</h2>
          <div className="status-container">
            <span className={getStatusBadgeClass(job.status)}>
              {job.status.replace("_", " ")}
            </span>
            {duration && (
              <span className="duration">Duration: {duration}</span>
            )}
          </div>
        </div>

        {/* Parameters Section */}
        <div className="detail-section">
          <h2 className="section-title">Parameters</h2>
          <div className="info-grid">
            {job.parameters?.type === "recommendations" ? (
              <>
                <div className="info-item">
                  <span className="info-label">Product:</span>
                  <span className="info-value">{job.parameters?.product || "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Recommendation type:</span>
                  <span className="info-value">
                    {job.parameters?.recommendation_type === "new_feature"
                      ? "New feature"
                      : job.parameters?.recommendation_type === "competing_product"
                        ? "Competing product"
                        : job.parameters?.recommendation_type === "improve_product"
                          ? "Improve product"
                          : job.parameters?.recommendation_type || "N/A"}
                  </span>
                </div>
                {job.parameters?.regenerate && (
                  <div className="info-item">
                    <span className="info-label">Regenerate:</span>
                    <span className="info-value">Yes</span>
                  </div>
                )}
              </>
            ) : job.parameters?.type === "analysis" ? (
              <>
                <div className="info-item">
                  <span className="info-label">Product:</span>
                  <span className="info-value">{job.parameters?.product || "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Max posts:</span>
                  <span className="info-value">{job.parameters?.max_posts ?? "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Skip recommendations:</span>
                  <span className="info-value">{job.parameters?.skip_recommendations ? "Yes" : "No"}</span>
                </div>
                {job.parameters?.regenerate && (
                  <div className="info-item">
                    <span className="info-label">Regenerate:</span>
                    <span className="info-value">Yes</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="info-item">
                  <span className="info-label">Topic:</span>
                  <span className="info-value">{job.parameters?.topic || "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Time Filter:</span>
                  <span className="info-value">{job.parameters?.time_filter || "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Limit:</span>
                  <span className="info-value">{job.parameters?.limit || "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Type:</span>
                  <span className="info-value">
                    {job.parameters?.is_custom ? "Custom Insights" : "Product Insights"}
                  </span>
                </div>
                {job.parameters?.subreddits && job.parameters.subreddits.length > 0 && (
                  <div className="info-item full-width">
                    <span className="info-label">Subreddits:</span>
                    <span className="info-value">
                      {job.parameters.subreddits.join(", ")}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Timestamps Section */}
        <div className="detail-section">
          <h2 className="section-title">Timestamps</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Created:</span>
              <span className="info-value">{formatDate(job.created_at)}</span>
            </div>
            {job.started_at && (
              <div className="info-item">
                <span className="info-label">Started:</span>
                <span className="info-value">{formatDate(job.started_at)}</span>
              </div>
            )}
            {job.completed_at && (
              <div className="info-item">
                <span className="info-label">Completed:</span>
                <span className="info-value">{formatDate(job.completed_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {job.results && (
          <div className="detail-section">
            <h2 className="section-title">Results</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Posts Scraped:</span>
                <span className="info-value">{job.results.posts_count || 0}</span>
              </div>
              {job.results.products_found && job.results.products_found.length > 0 && (
                <div className="info-item full-width">
                  <span className="info-label">Products Found:</span>
                  <div className="products-list">
                    {job.results.products_found.map((product, index) => (
                      <span key={index} className="product-tag">
                        {product}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {job.status === "completed" && job.results.products_found && job.results.products_found.length > 0 && (
              <button className="view-results-button" onClick={handleViewResults}>
                View Results
                <ArrowRight size={16} aria-hidden style={{ marginLeft: "6px", verticalAlign: "middle" }} />
              </button>
            )}
          </div>
        )}

        {/* Error Section */}
        {job.error && (
          <div className="detail-section error-section">
            <h2 className="section-title">Error</h2>
            <div className="error-content">
              {job.error}
            </div>
          </div>
        )}

        {/* Pipeline logs Section */}
        <div className="detail-section pipeline-logs-section">
          <h2 className="section-title">Pipeline logs</h2>
          {job.logs && job.logs.length > 0 ? (
            <div className="pipeline-logs">
              {job.logs.map((entry, index) => (
                <div key={index} className="log-entry info-item" data-step={entry.step}>
                  <span className="info-label">{entry.step.replace(/_/g, " ")}</span>
                  <span className="info-value log-message">{entry.message}</span>
                  {entry.timestamp && (
                    <span className="log-timestamp">{formatDate(entry.timestamp)}</span>
                  )}
                  {entry.details != null && (
                    <div className="log-details">
                      {Array.isArray(entry.details)
                        ? entry.details.join(", ")
                        : typeof entry.details === "object"
                          ? JSON.stringify(entry.details)
                          : String(entry.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-logs">No pipeline logs for this job.</p>
          )}
        </div>

        {/* Credits Section */}
        {job.credits_used !== null && job.credits_used !== undefined && (
          <div className="detail-section">
            <h2 className="section-title">Credits</h2>
            <div className="info-item">
              <span className="info-label">Credits Used:</span>
              <span className="info-value">{job.credits_used}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDetailPage;

