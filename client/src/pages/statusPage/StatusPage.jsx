import { useEffect, useState } from "react";
import { fetchStatus, fetchUserJobs } from "@/api/api";
import { Activity, TrendingUp, FileText, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import "./StatusPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";
import LoadingState from "@/components/LoadingState/LoadingState";

const StatusPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch status data
        const statusData = await fetchStatus();
        
        // Fetch user jobs to get active jobs
        const jobsData = await fetchUserJobs();
        const allJobs = jobsData.jobs || [];
        
        // Calculate analytics
        const activeJobs = allJobs.filter(job => 
          job.status === 'pending' || job.status === 'in_progress'
        );
        
        const completedJobs = allJobs.filter(job => job.status === 'completed');
        const failedJobs = allJobs.filter(job => job.status === 'failed');
        
        setAnalytics({
          active_jobs: activeJobs,
          active_jobs_count: activeJobs.length,
          job_stats: {
            total: allJobs.length,
            completed: completedJobs.length,
            failed: failedJobs.length,
            pending: allJobs.filter(j => j.status === 'pending').length,
            in_progress: allJobs.filter(j => j.status === 'in_progress').length
          },
          posts_stats: {
            total: statusData.raw_posts_count || 0,
            analyzed: statusData.analyzed_posts_count || 0,
            pain_points: statusData.pain_points_count || 0
          }
        });
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="status-page">
        <PageHeader title="Status" subtitle="Analytics and system overview" />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="status-page">
        <PageHeader title="Status" subtitle="Analytics and system overview" />
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!analytics) return null;

  const { active_jobs, job_stats, posts_stats } = analytics;

  return (
    <div className="status-page">
      <PageHeader title="Status" subtitle="Analytics and system overview" />
      
      <div className="analytics-grid">
        {/* Active Jobs Section */}
        <div className="analytics-card active-jobs-card">
          <div className="card-header">
            <Activity className="card-icon" size={24} />
            <h2>Live Activity</h2>
          </div>
          <div className="card-content">
            {active_jobs.length > 0 ? (
              <div className="active-jobs-list">
                {active_jobs.map((job) => (
                  <div key={job._id} className="active-job-item">
                    <div className="job-info">
                      <span className="job-topic">{job.parameters?.topic || 'Unknown'}</span>
                      <span className={`job-status ${job.status}`}>
                        {job.status === 'pending' && <Clock size={14} />}
                        {job.status === 'in_progress' && <Activity size={14} />}
                        {job.status}
                      </span>
                    </div>
                    <div className="job-time">
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <CheckCircle2 size={32} />
                <p>No active jobs</p>
              </div>
            )}
          </div>
        </div>

        {/* Job Statistics */}
        <div className="analytics-card stats-card">
          <div className="card-header">
            <TrendingUp className="card-icon" size={24} />
            <h2>Job Statistics</h2>
          </div>
          <div className="card-content">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{job_stats.total}</div>
                <div className="stat-label">Total Jobs</div>
              </div>
              <div className="stat-item success">
                <div className="stat-value">{job_stats.completed}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-item warning">
                <div className="stat-value">{job_stats.pending + job_stats.in_progress}</div>
                <div className="stat-label">Active</div>
              </div>
              <div className="stat-item error">
                <div className="stat-value">{job_stats.failed}</div>
                <div className="stat-label">Failed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Statistics */}
        <div className="analytics-card posts-card">
          <div className="card-header">
            <FileText className="card-icon" size={24} />
            <h2>Content Analyzed</h2>
          </div>
          <div className="card-content">
            <div className="posts-stats">
              <div className="posts-stat-item">
                <div className="posts-stat-value">{posts_stats.total.toLocaleString()}</div>
                <div className="posts-stat-label">Total Posts</div>
              </div>
              <div className="posts-stat-item">
                <div className="posts-stat-value">{posts_stats.analyzed.toLocaleString()}</div>
                <div className="posts-stat-label">Analyzed</div>
              </div>
              <div className="posts-stat-item">
                <div className="posts-stat-value">{posts_stats.pain_points.toLocaleString()}</div>
                <div className="posts-stat-label">Pain Points</div>
              </div>
            </div>
            {posts_stats.total > 0 && (
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(posts_stats.analyzed / posts_stats.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPage;
