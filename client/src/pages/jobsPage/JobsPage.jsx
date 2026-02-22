import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUserJobs, cancelJob } from "@/api/api";
import { useNotification } from "@/context/NotificationContext";
import "./jobsPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";
import LoadingState from "@/components/LoadingState/LoadingState";
import JobCard from "@/components/JobCard/JobCard";

const JobsPage = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [cancellingJobId, setCancellingJobId] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(null);
  const { showNotification } = useNotification();

  // Fetch user's jobs
  const fetchJobs = async (status = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchUserJobs(status);
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError(err.message || "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Fetch jobs when filter changes
  useEffect(() => {
    const status = activeFilter === "all" ? null : activeFilter;
    fetchJobs(status);
  }, [activeFilter]);

  const handleJobClick = (jobId) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleCancelClick = (e, jobId) => {
    e.stopPropagation();
    setShowCancelConfirm(jobId);
  };

  const handleCancelConfirm = async (jobId) => {
    setCancellingJobId(jobId);
    try {
      const response = await cancelJob(jobId);
      if (response.status === 'success') {
        showNotification(response.message || 'Job cancelled successfully. 1 credit refunded.', 'success');
        // Refresh jobs list
        const status = activeFilter === "all" ? null : activeFilter;
        await fetchJobs(status);
      } else {
        showNotification(response.message || 'Failed to cancel job', 'error');
      }
    } catch (err) {
      console.error("Error cancelling job:", err);
      showNotification(err.message || 'Failed to cancel job', 'error');
    } finally {
      setCancellingJobId(null);
      setShowCancelConfirm(null);
    }
  };

  const handleCancelCancel = () => {
    setShowCancelConfirm(null);
  };

  const filters = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "in_progress", label: "In Progress" },
    { id: "completed", label: "Completed" },
    { id: "failed", label: "Failed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="jobs-page">
      <PageHeader 
        title="Jobs"
        description="View your scraping job history and status"
      />

      {/* Status Filters */}
      <div className="filters-section">
        <div className="filters-container">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={`filter-tab ${activeFilter === filter.id ? "active" : ""}`}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
              {activeFilter === filter.id && jobs.length > 0 && (
                <span className="filter-count">({jobs.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Jobs List */}
          <div className="jobs-list-container">
            {jobs.length > 0 ? (
              <>
                <div className="jobs-count">
                  {jobs.length} job{jobs.length !== 1 ? "s" : ""} found
                </div>
                <div className="jobs-grid">
                  {jobs.map((job) => (
                    <JobCard
                      key={job._id}
                      job={job}
                      onClick={handleJobClick}
                      showCancel
                      onCancelClick={handleCancelClick}
                      cancellingJobId={cancellingJobId}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="no-jobs">
                <p>No jobs found</p>
                <p className="no-jobs-subtitle">
                  {activeFilter === "all"
                    ? "Start a new scraping job to see it here"
                    : `No ${activeFilter.replace("_", " ")} jobs found`}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="cancel-confirm-modal" onClick={handleCancelCancel}>
          <div className="cancel-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Cancel Job</h2>
            <p>Are you sure you want to cancel this job?</p>
            <p className="cancel-info">
              You will receive a refund of <strong>1 credit</strong>. The job will be marked as cancelled and cannot be resumed.
            </p>
            <div className="cancel-confirm-actions">
              <button
                className="cancel-button-secondary"
                onClick={handleCancelCancel}
                disabled={cancellingJobId === showCancelConfirm}
              >
                Keep Job
              </button>
              <button
                className="cancel-button-primary"
                onClick={() => handleCancelConfirm(showCancelConfirm)}
                disabled={cancellingJobId === showCancelConfirm}
              >
                {cancellingJobId === showCancelConfirm ? 'Cancelling...' : 'Yes, Cancel Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsPage;

