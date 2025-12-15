// PostsPage.jsx
import { useEffect, useState, useCallback } from "react";
import { fetchPosts } from "@/api/api";
import "./postsPage.scss";
import PageHeader from "@/components/PageHeader/PageHeader";
import SearchBar from "@/components/SearchBar/SearchBar";
import FilterControls from "@/components/FilterControls/FilterControls";
import LoadingState from "@/components/LoadingState/LoadingState";

const PostsPage = ({ productFilter = null }) => {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Add this to your state declarations at the top of the component
  const [viewMode, setViewMode] = useState("list"); // 'list' or 'grid'

  // API filter options
  const [apiFilters, setApiFilters] = useState({
    product: productFilter || "",
    has_pain_points: true,
    limit: 20,
    sort_by: "score",
    sort_order: "desc",
  });

  // Local filter options
  const [localFilters, setLocalFilters] = useState({
    minScore: "",
    maxScore: "",
    subreddit: "",
  });

  // Add this function to handle view mode toggle
  const toggleViewMode = () => {
    setViewMode(viewMode === "list" ? "grid" : "list");
  };

  // Load posts from API
  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPosts(apiFilters);
      setPosts(data.posts || []);
      setFilteredPosts(data.posts || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      setError("Failed to fetch posts. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [apiFilters]);

  // Apply local filters and search
  useEffect(() => {
    if (posts.length === 0) return;

    let result = [...posts];

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (post) =>
          post.title?.toLowerCase().includes(term) ||
          post.body?.toLowerCase().includes(term) ||
          post.author?.toLowerCase().includes(term) ||
          post.subreddit?.toLowerCase().includes(term)
      );
    }

    // Apply min score filter
    if (localFilters.minScore !== "") {
      const minScore = parseInt(localFilters.minScore);
      result = result.filter((post) => post.score >= minScore);
    }

    // Apply max score filter
    if (localFilters.maxScore !== "") {
      const maxScore = parseInt(localFilters.maxScore);
      result = result.filter((post) => post.score <= maxScore);
    }

    // Apply subreddit filter
    if (localFilters.subreddit) {
      result = result.filter(
        (post) =>
          post.subreddit?.toLowerCase() === localFilters.subreddit.toLowerCase()
      );
    }

    setFilteredPosts(result);
  }, [posts, searchTerm, localFilters]);

  // Update filters when productFilter changes
  useEffect(() => {
    if (productFilter !== null) {
      setApiFilters((prev) => ({ ...prev, product: productFilter }));
    }
  }, [productFilter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Handle API filter changes
  const handleApiFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setApiFilters({
      ...apiFilters,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Handle local filter changes
  const handleLocalFilterChange = (e) => {
    const { name, value } = e.target;
    setLocalFilters({
      ...localFilters,
      [name]: value,
    });
  };

  // Handle API filter form submission
  const handleApiSubmit = (e) => {
    e.preventDefault();
    loadPosts();
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle clearing all filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setLocalFilters({
      minScore: "",
      maxScore: "",
      subreddit: "",
    });
  };

  // Get unique subreddits for dropdown
  const uniqueSubreddits = posts && posts.length > 0
    ? [...new Set(posts.map((post) => post.subreddit).filter(Boolean))]
    : [];

  return (
    <div className="posts-container">
      <PageHeader 
        title="Insights"
        description="View and filter the most recent insights and discussions"
      />

      {/* Unified Filters Section */}
      <div className="filters-container">
        <h3 className="filters-title">Search & Filters</h3>

        <form onSubmit={handleApiSubmit}>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search insights, titles, sources..."
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

          <div className="filter-grid">
            <div className="filter-item">
              <label>Product</label>
              <input
                type="text"
                name="product"
                value={apiFilters.product}
                onChange={handleApiFilterChange}
              />
            </div>

            <div className="filter-item">
              <label>Limit</label>
              <input
                type="number"
                name="limit"
                min="1"
                max="100"
                value={apiFilters.limit}
                onChange={handleApiFilterChange}
              />
            </div>

            <div className="filter-item">
              <label>Sort By</label>
              <select
                name="sort_by"
                value={apiFilters.sort_by}
                onChange={handleApiFilterChange}
              >
                <option value="score">Score</option>
                <option value="created_at">Date</option>
                <option value="num_comments">Comments</option>
              </select>
            </div>

            <div className="filter-item">
              <label>Sort Order</label>
              <select
                name="sort_order"
                value={apiFilters.sort_order}
                onChange={handleApiFilterChange}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            <div className="filter-item">
              <label>Min Score</label>
              <input
                type="number"
                name="minScore"
                value={localFilters.minScore}
                onChange={handleLocalFilterChange}
                placeholder="Min"
              />
            </div>

            <div className="filter-item">
              <label>Max Score</label>
              <input
                type="number"
                name="maxScore"
                value={localFilters.maxScore}
                onChange={handleLocalFilterChange}
                placeholder="Max"
              />
            </div>

            <div className="filter-item">
              <label>Source</label>
              <select
                name="subreddit"
                value={localFilters.subreddit}
                onChange={handleLocalFilterChange}
              >
                <option value="">All Sources</option>
                {uniqueSubreddits.map((subreddit) => (
                  <option key={subreddit} value={subreddit}>
                    {subreddit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-bottom">
            <div className="checkbox-container">
              <label>
                <input
                  type="checkbox"
                  name="has_pain_points"
                  checked={apiFilters.has_pain_points}
                  onChange={handleApiFilterChange}
                />
                <span>Only show posts with pain points</span>
              </label>
            </div>

            <button type="submit" className="fetch-button" disabled={loading}>
              {loading ? "Fetching..." : "Fetch Posts"}
            </button>
          </div>
        </form>
      </div>
      <section className="results-controls">
        <div className="controls-left">
          <button
            className="clear-button"
            onClick={handleClearFilters}
            type="button"
          >
            Clear Filters
          </button>
        </div>
        <div className="controls-middle">
          <div className="results-meta">
            <span className="results-count">
              Showing {filteredPosts.length} of {posts.length} posts
            </span>
            {filteredPosts.length !== posts.length && (
              <span className="filtered-note">
                (filtered from {posts.length} total posts)
              </span>
            )}
          </div>
        </div>
        <div className="controls-right">
          <div className="view-toggle-container">
            <button
              className={`view-toggle-button ${
                viewMode === "list" ? "active" : ""
              }`}
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <span className="icon">☰</span>
            </button>
            <button
              className={`view-toggle-button ${
                viewMode === "grid" ? "active" : ""
              }`}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <span className="icon">⊞</span>
            </button>
          </div>
        </div>
      </section>

      {/* Error Message */}
      {error && <div className="error-message">{error}</div>}

      {/* Loading State */}
      {loading ? (
        <div className="loading-indicator">Loading posts...</div>
      ) : (
        <div
          className={`posts-container ${
            viewMode === "grid" ? "grid-view" : "list-view"
          }`}
        >
          {filteredPosts.length > 0 ? (
            viewMode === "list" ? (
              // List View (Detailed)
              <div className="posts-list">
                {filteredPosts.map((post) => (
                  <div className="post-card" key={post.id}>
                    <div className="post-header">
                      <h3 className="post-title">{post.title}</h3>
                      <div className="post-score">{post.score} points</div>
                    </div>

                    <div className="post-meta">
                      <span className="subreddit">{post.subreddit}</span>
                      <span className="separator">•</span>
                      <span className="author">u/{post.author}</span>
                      {post.created_utc && (
                        <>
                          <span className="separator">•</span>
                          <span className="date">
                            {new Date(post.created_utc).toLocaleDateString()}
                          </span>
                        </>
                      )}
                      {post.sentiment && (
                        <>
                          <span className="separator">•</span>
                          <span
                            className={`sentiment ${
                              post.sentiment > 0
                                ? "positive"
                                : post.sentiment < 0
                                ? "negative"
                                : "neutral"
                            }`}
                          >
                            Sentiment: {post.sentiment.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>

                    {post.body && (
                      <div className="post-body">
                        <p>
                          {post.body.length > 200
                            ? post.body.substring(0, 200) + "..."
                            : post.body}
                        </p>
                      </div>
                    )}

                    {/* Products Section */}
                    {post.products && post.products.length > 0 && (
                      <div className="post-products">
                        <h4>Products:</h4>
                        <div className="tags-container">
                          {post.products.map((product, index) => (
                            <span key={index} className="product-tag">
                              {product}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Topics Section */}
                    {post.topics && post.topics.length > 0 && (
                      <div className="post-topics">
                        <h4>Topics:</h4>
                        <div className="tags-container">
                          {post.topics.map((topic, index) => (
                            <span key={index} className="topic-tag">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pain Points Section */}
                    {post.pain_points && post.pain_points.length > 0 && (
                      <div className="post-pain-points">
                        <h4>Pain Points:</h4>
                        <div className="tags-container">
                          {post.pain_points.map((painPoint, index) => {
                            const [category, type] = painPoint.split(":");
                            return (
                              <span
                                key={index}
                                className={`pain-point-tag ${type}`}
                              >
                                <span className="category">{category}</span>
                                <span className="type">{type}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="post-footer">
                      <div className="comments-count">
                        {post.num_comments || 0} comments
                      </div>
                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-button"
                        >
                          View Original
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Grid View (Compact)
              <div className="posts-grid">
                {filteredPosts.map((post) => (
                  <div className="grid-card" key={post.id}>
                    <h3 className="grid-title">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {post.title.length > 80
                          ? post.title.substring(0, 80) + "..."
                          : post.title}
                      </a>
                    </h3>

                    <div className="grid-meta">
                      <span className="subreddit">{post.subreddit}</span>
                      <span className="score">{post.score}pts</span>
                    </div>

                    {post.sentiment && (
                      <div
                        className={`grid-sentiment ${
                          post.sentiment > 0
                            ? "positive"
                            : post.sentiment < 0
                            ? "negative"
                            : "neutral"
                        }`}
                      >
                        {post.sentiment.toFixed(2)}
                      </div>
                    )}

                    {post.products && post.products.length > 0 && (
                      <div className="grid-products">
                        {post.products.map((product, index) => (
                          <span key={index} className="grid-product-tag">
                            {product}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="no-posts">
              {posts.length > 0
                ? "No posts match your filters. Try adjusting your search criteria."
                : "No posts found. Try fetching posts using the controls above."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostsPage;
