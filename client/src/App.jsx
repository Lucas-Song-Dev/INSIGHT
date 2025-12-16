import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./App.scss";
import Post from "./pages/postsPage/PostsPage";
import AnalysisPage from "./pages/analysisPage/AnalysisPage";
import ScrapePage from "./pages/scrapePage/ScrapePage";
import RecomendationPage from "./pages/recommendationPage/RecomendationPage";
import AboutPage from "./pages/aboutPage/AboutPage";
import ResultsPage from "./pages/resultsPage/ResultsPage";
import ProductDetailPage from "./pages/productDetailPage/ProductDetailPage";
import InsightsPage from "./pages/insightsPage/InsightsPage";
import Sidebar from "./components/Sidebar/Sidebar";
import ProfilePage from "./pages/profilePage/ProfilePage";
import StatusPage from "./pages/statusPage/StatusPage";
import LoginPage from "./pages/auth/LoginPage";
import { useAuth } from "./context/AuthContext";
import { logoutUser, fetchPosts, fetchClaudeAnalysis, fetchAllProducts } from "./api/api";
import Notification from "./components/Notification/Notification";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import Background from "./components/Background/Background";

// Helper functions for home page
const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
};

const getUserName = (user) => {
  console.log('[APP] getUserName called with user:', {
    hasUser: !!user,
    preferred_name: user?.preferred_name,
    full_name: user?.full_name,
    username: user?.username
  });
  
  if (!user) {
    console.log('[APP] No user, returning "User"');
    return "User";
  }
  
  // Priority: preferred_name > full_name > username > "User"
  const name = user.preferred_name || user.full_name || user.username || "User";
  console.log('[APP] Returning name:', name);
  return name;
};

// App Content Component (needs to be inside Router)
function AppContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();

  // Periodic API polling for debugging - logs posts and analysis data
  // PERFORMANCE FIX: Only enable polling in development mode
  useEffect(() => {
    // Skip polling in production
    if (import.meta.env.MODE === 'production') return;
    if (!isAuthenticated) return;

    const pollAPIs = async () => {
      const timestamp = new Date().toISOString();
      console.log(`\n[${timestamp}] === FRONTEND API POLL ===`);

      // Fetch posts
      try {
        console.log("[POLL] Fetching posts...");
        const postsData = await fetchPosts({ limit: 10 });
        console.log("[POLL] Posts API Response:", {
          status: postsData.status,
          postsCount: postsData.posts?.length || 0,
          totalPosts: postsData.total || 0,
          samplePost: postsData.posts?.[0] ? {
            title: postsData.posts[0].title?.substring(0, 50),
            product: postsData.posts[0].product,
            subreddit: postsData.posts[0].subreddit
          } : null
        });
      } catch (err) {
        console.error("[POLL] Posts API Error:", err.message || err);
      }

      // Fetch all products
      try {
        console.log("[POLL] Fetching all products...");
        const productsData = await fetchAllProducts();
        console.log("[POLL] All Products API Response:", {
          status: productsData.status,
          productsCount: productsData.products?.length || 0,
          products: productsData.products || []
        });

        // If we have products with analysis, fetch analysis for the first one
        const productsWithAnalysis = (productsData.products || [])
          .filter(p => typeof p === 'object' ? p.has_analysis : false);
        
        if (productsWithAnalysis.length > 0) {
          const firstProduct = typeof productsWithAnalysis[0] === 'object' 
            ? productsWithAnalysis[0].name 
            : productsWithAnalysis[0];
          try {
            console.log(`[POLL] Fetching analysis for product: ${firstProduct}...`);
            const analysisData = await fetchClaudeAnalysis({ product: [firstProduct] });
            console.log("[POLL] Analysis API Response:", {
              status: analysisData.status,
              analysesCount: analysisData.analyses?.length || 0,
              hasAnalysis: analysisData.analyses && analysisData.analyses.length > 0,
              painPointsCount: analysisData.analyses?.[0]?.common_pain_points?.length || 0,
              samplePainPoint: analysisData.analyses?.[0]?.common_pain_points?.[0] ? {
                category: analysisData.analyses[0].common_pain_points[0].category,
                indicator: analysisData.analyses[0].common_pain_points[0].indicator,
                severity: analysisData.analyses[0].common_pain_points[0].severity
              } : null
            });
          } catch (analysisErr) {
            console.error(`[POLL] Analysis API Error for ${firstProduct}:`, analysisErr.message || analysisErr);
          }
        }
      } catch (err) {
        console.error("[POLL] All Products API Error:", err.message || err);
      }

      console.log(`[${timestamp}] === END API POLL ===\n`);
    };

    // Poll immediately on mount
    pollAPIs();

    // Then poll every 30 seconds
    const intervalId = setInterval(pollAPIs, 30000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  // Handle logout click
  const handleLogout = async () => {
    try {
      await logoutUser();
      logout(); // Update auth context
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // If auth is still loading, you can show a loading spinner
  if (isLoading) {
    return <div className="loading-container">Loading...</div>;
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={login} />;
  }

  // Check if user is new (created within last 5 minutes)
  const isNewUser = () => {
    if (!user?.created_at) return false;
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const diffMinutes = (now - createdAt) / (1000 * 60);
    return diffMinutes < 5;
  };

  // Define the content to render based on active page
  const renderContent = () => {
    switch (activePage) {
      case "insights":
        return <InsightsPage setActivePage={setActivePage} />;
      case "home":
        return (
          <div className="home-container">
            <div className="home-header">
              <h1>Good {getTimeOfDay()}, {getUserName(user)}</h1>
              <p className="home-subtitle">Welcome to your insights dashboard</p>

              <div className="quick-stats">
                <div className="stat-card">
                  <div className="stat-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M16 8l-8 8"/>
                      <path d="M12 8v8"/>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{user?.credits || 0}</div>
                    <div className="stat-label">Credits Available</div>
                  </div>
                </div>
                <button className="stat-card clickable" onClick={() => setActivePage("scrapepage")}>
                  <div className="stat-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="M21 21l-4.35-4.35"/>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">Start</div>
                    <div className="stat-label">Find Insights</div>
                  </div>
                </button>
                <button className="stat-card clickable" onClick={() => setActivePage("results")}>
                  <div className="stat-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10"/>
                      <line x1="12" y1="20" x2="12" y2="4"/>
                      <line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">View</div>
                    <div className="stat-label">Results</div>
                  </div>
                </button>
              </div>

              <div className="home-actions">
                <button
                  className="insights-button"
                  onClick={() => setActivePage("insights")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '8px'}}>
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  Learn About Real User Insights →
                </button>
              </div>
            </div>
          </div>
        );
      case "scrapepage":
        return <ScrapePage />;
      case "analysisPage":
        return <AnalysisPage />;
      case "results":
        return (
          <ResultsPage
            setActivePage={setActivePage}
            setSelectedProduct={setSelectedProduct}
          />
        );
      case "productDetail":
        return (
          <ProductDetailPage
            selectedProduct={selectedProduct}
            setActivePage={setActivePage}
          />
        );
      case "about":
        return <AboutPage />;
      case "profile":
        return <ProfilePage />;
      case "status":
        return <StatusPage />;
      default:
        return (
          <div>
            <h1>Page not found</h1>
            <p>The requested page does not exist.</p>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      <Background />
      {/* Sidebar Navigation */}
      <Sidebar
        handleLogout={handleLogout}
        onCollapseChange={setSidebarCollapsed}
      />

      {/* Main Content */}
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-testid="main-content">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<InsightsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/find-insights" element={<ScrapePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/products/:productName" element={<ProductDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
          </Routes>
        </ErrorBoundary>
        <Notification />
      </div>
    </div>
  );
}

// Main App component with Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
