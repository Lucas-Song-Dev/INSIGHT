import { useState, useEffect } from "react";
import "./App.scss";
import Post from "./pages/postsPage/PostsPage";
import AnalysisPage from "./pages/analysisPage/AnalysisPage";
import ScrapePage from "./pages/scrapePage/ScrapePage";
import RecomendationPage from "./pages/recommendationPage/RecomendationPage";
import AboutPage from "./pages/aboutPage/AboutPage";
import ResultsPage from "./pages/resultsPage/ResultsPage";
import ProductDetailPage from "./pages/productDetailPage/ProductDetailPage";
import Sidebar from "./components/Sidebar/Sidebar";
import ProfilePage from "./pages/profilePage/ProfilePage";
import StatusPage from "./pages/statusPage/StatusPage";
import LoginPage from "./pages/auth/LoginPage";
import { useAuth } from "./context/AuthContext";
import { logoutUser, fetchPosts, fetchOpenAIAnalysis, fetchAllProducts } from "./api/api";
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
  if (!user) return "User";
  return user.username || "User";
};

function App() {
  const [activePage, setActivePage] = useState("home");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();

  // Periodic API polling for debugging - logs posts and analysis data
  useEffect(() => {
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
            const analysisData = await fetchOpenAIAnalysis({ product: [firstProduct] });
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

  // Define the content to render based on active page
  const renderContent = () => {
    switch (activePage) {
      case "home":
        return (
          <div className="home-container">
            <div className="home-header">
              <h1>Good {getTimeOfDay()}, {getUserName(user)}</h1>
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-container">
      <Background />
      {/* Sidebar Navigation */}
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        handleLogout={handleLogout}
        onCollapseChange={setSidebarCollapsed}
      />

      {/* Main Content */}
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-testid="main-content">
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
        <Notification />
      </div>
    </div>
  );
}

export default App;
