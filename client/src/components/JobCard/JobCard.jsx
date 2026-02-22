import React from "react";
import { ArrowRight } from "lucide-react";
import "./JobCard.scss";

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
    case "cancelled":
      return "status-badge cancelled";
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

const getJobTitle = (job) => {
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
};

const JobCard = ({
  job,
  onClick,
  showCancel = false,
  onCancelClick,
  cancellingJobId = null,
}) => {
  if (!job) return null;

  const duration = calculateDuration(job.started_at, job.completed_at);

  const handleClick = (e) => {
    if (e.target.closest(".cancel-job-button") || e.target.closest(".cancel-confirm-modal")) {
      return;
    }
    onClick?.(job._id, e);
  };

  const handleCancelClick = (e) => {
    e.stopPropagation();
    onCancelClick?.(e, job._id);
  };

  return (
    <div className="job-card" onClick={handleClick}>
      <div className="job-card-header">
        <h3 className="job-topic">{getJobTitle(job)}</h3>
        <div className="job-header-right">
          <span className={getStatusBadgeClass(job.status)}>
            {job.status.replace("_", " ")}
          </span>
          {showCancel && (job.status === "pending" || job.status === "in_progress") && (
            <button
              className="cancel-job-button"
              onClick={handleCancelClick}
              disabled={cancellingJobId === job._id}
            >
              {cancellingJobId === job._id ? "Cancelling..." : "Cancel"}
            </button>
          )}
        </div>
      </div>
      <div className="job-card-body">
        <div className="job-info">
          <div className="info-item">
            <span className="info-label">Created:</span>
            <span className="info-value">{formatDate(job.created_at)}</span>
          </div>
          {duration && (
            <div className="info-item">
              <span className="info-label">Duration:</span>
              <span className="info-value">{duration}</span>
            </div>
          )}
          {job.results && (
            <div className="info-item">
              <span className="info-label">Posts:</span>
              <span className="info-value">{job.results.posts_count || 0}</span>
            </div>
          )}
          {job.results?.products_found && job.results.products_found.length > 0 && (
            <div className="info-item">
              <span className="info-label">Products:</span>
              <span className="info-value">{job.results.products_found.length}</span>
            </div>
          )}
        </div>
      </div>
      <div className="job-card-footer">
        <span className="view-details">
          Click to view details
          <ArrowRight size={14} aria-hidden style={{ marginLeft: "4px", verticalAlign: "middle" }} />
        </span>
      </div>
    </div>
  );
};

export default JobCard;
