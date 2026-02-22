import { Target, Lightbulb, BarChart3, Activity } from "lucide-react";
import "./aboutPage.scss";

const AboutPage = () => {
  return (
    <div className="about-container">
      <div className="about-header">
        <h1>About INSIGHT</h1>
        <p className="subtitle">AI-Powered Insights Discovery Platform</p>
      </div>

      <section className="about-section">
        <h2>Overview</h2>
        <p>
          INSIGHT is a comprehensive platform designed to discover, analyze, and generate 
          actionable insights from online discussions. By leveraging advanced Natural Language 
          Processing (NLP) techniques and AI, we process vast amounts of user feedback to identify 
          common pain points, sentiment trends, and improvement opportunities for products 
          and services.
        </p>
        <p>
          Our system combines intelligent data discovery, sophisticated sentiment analysis 
          with 94% classification accuracy, and AI-powered recommendation generation to 
          help teams make data-driven decisions based on real user experiences.
        </p>
      </section>

      <section className="about-section">
        <h2>Technology Stack</h2>
        <div className="tech-grid">
          <div className="tech-category">
            <h3>Backend</h3>
            <ul>
              <li><strong>Python 3.11+</strong> - Core application logic</li>
              <li><strong>Flask</strong> - RESTful API framework</li>
              <li><strong>Flask-RESTful</strong> - API endpoint management</li>
              <li><strong>MongoDB</strong> - NoSQL database for flexible data storage</li>
              <li><strong>PyMongo</strong> - MongoDB driver</li>
            </ul>
          </div>

          <div className="tech-category">
            <h3>Data & AI</h3>
            <ul>
              <li><strong>Anthropic Claude 3 Haiku</strong> - AI-powered analysis and insights</li>
              <li><strong>NLTK</strong> - Natural language processing</li>
              <li><strong>scikit-learn</strong> - Machine learning models</li>
              <li><strong>pandas</strong> - Data manipulation</li>
              <li><strong>numpy</strong> - Numerical computing</li>
            </ul>
          </div>

          <div className="tech-category">
            <h3>Frontend</h3>
            <ul>
              <li><strong>React 18</strong> - UI framework</li>
              <li><strong>Vite</strong> - Build tool</li>
              <li><strong>SCSS</strong> - Styling</li>
              <li><strong>Axios</strong> - HTTP client</li>
            </ul>
          </div>

          <div className="tech-category">
            <h3>Data Collection</h3>
            <ul>
              <li><strong>PRAW</strong> - Data collection</li>
              <li><strong>JWT</strong> - Authentication</li>
              <li><strong>bcrypt</strong> - Password hashing</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>Features</h2>
        <div className="features-grid">
          <div className="feature-item">
            <h3>Intelligent Discovery</h3>
            <p>
              AI-powered discovery of relevant discussions and insights. 
              Simply enter a topic or product name, and our system automatically finds 
              and analyzes relevant content.
            </p>
          </div>

          <div className="feature-item">
            <h3>🧠 Advanced NLP Analysis</h3>
            <p>
              Cleaning and normalization of text data with sophisticated processing. 
              Our pipeline removes noise, normalizes text, and extracts meaningful 
              information for analysis.
            </p>
          </div>

          <div className="feature-item">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '8px'}}>
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              Sentiment Analysis
            </h3>
            <p>
              Multi-class sentiment classification with 94% accuracy across 
              positive, negative, and neutral categories. Uses advanced machine learning 
              techniques for reliable sentiment detection.
            </p>
          </div>

          <div className="feature-item">
            <h3><Target size={20} aria-hidden style={{ marginRight: "8px", verticalAlign: "middle" }} />Pain Point Detection</h3>
            <p>
              Automated identification of common pain points, issues, and user frustrations. 
              Categorizes problems by type and severity to help prioritize improvements.
            </p>
          </div>

          <div className="feature-item">
            <h3><Lightbulb size={20} aria-hidden style={{ marginRight: "8px", verticalAlign: "middle" }} />AI-Powered Recommendations</h3>
            <p>
              Generate actionable recommendations using Claude AI. Provides 
              specific, implementable suggestions for addressing identified pain points.
            </p>
          </div>

          <div className="feature-item">
            <h3>
              <Activity size={20} aria-hidden style={{ marginRight: "8px", verticalAlign: "middle" }} />
              Data Visualization
            </h3>
            <p>
              Interactive dashboards and visualizations to explore insights, 
              trends, and patterns in user feedback. Filter, search, and analyze 
              data with ease.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>Application Workflow</h2>
        <p>
          The platform follows a streamlined workflow designed for efficient insight discovery:
        </p>
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="workflow-icon">1</div>
            <div className="workflow-content">
              <h4>1. Find Insights</h4>
              <p>
                Enter a topic or product name to discover relevant insights. Our AI automatically 
                finds relevant discussions and runs advanced NLP analysis to identify pain points 
                with 94% sentiment accuracy.
              </p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="workflow-icon">2</div>
            <div className="workflow-content">
              <h4>2. Results Dashboard</h4>
              <p>
                View all analyzed topics in a centralized Results page. Search and filter
                to quickly find topics of interest. Each topic shows available data types
                (Posts, Analysis, Recommendations).
              </p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="workflow-icon">
              <BarChart3 size={24} aria-hidden />
            </div>
            <div className="workflow-content">
              <h4>3. Topic Detail View</h4>
              <p>
                Click any topic to access its comprehensive detail page with three integrated tabs:
                <strong>Posts</strong> for browsing collected discussions,
                <strong>Analysis</strong> for pain point insights, and
                <strong>Recommendations</strong> for AI-generated solutions.
              </p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="workflow-icon">
              <Target size={24} aria-hidden />
            </div>
            <div className="workflow-content">
              <h4>4. Take Action</h4>
              <p>
                Use the generated insights and recommendations to make data-driven decisions.
                Prioritize improvements based on severity and impact analysis.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>Data Privacy & Ethics</h2>
        <p>
          INSIGHT is committed to responsible data usage and user privacy:
        </p>
        <ul className="privacy-list">
          <li>Only public discussions are analyzed (no private messages or deleted content)</li>
          <li>All data processing follows ethical guidelines for online content analysis</li>
          <li>User authentication ensures secure access to insights</li>
          <li>No personally identifiable information is stored or displayed</li>
          <li>All analysis is performed on aggregated, anonymized data</li>
        </ul>
      </section>

      <section className="about-section">
        <h2>Performance & Accuracy</h2>
        <p>
          Our NLP pipeline achieves industry-leading performance metrics:
        </p>
        <ul className="performance-list">
          <li><strong>94% Sentiment Classification Accuracy</strong> - Validated across diverse datasets</li>
          <li><strong>Real-time Processing</strong> - Fast analysis and insight generation</li>
          <li><strong>Scalable Architecture</strong> - Handles large volumes of data efficiently</li>
          <li><strong>Continuous Improvement</strong> - Models are regularly updated and refined</li>
        </ul>
      </section>

      <section className="about-section">
        <h2>Getting Started</h2>
        <p>
          Ready to discover insights? Follow these simple steps:
        </p>
        <ol className="getting-started-list">
          <li>Navigate to <strong>Find Insights</strong> from the sidebar</li>
          <li>Enter a topic or product name you want to analyze</li>
          <li>Select your desired time range</li>
          <li>Click <strong>Find Insights</strong> to start the discovery process</li>
          <li>View results in the <strong>Results</strong> page</li>
          <li>Explore detailed analysis and recommendations for any topic</li>
        </ol>
      </section>

      <section className="about-section">
        <h2>Support & Documentation</h2>
        <p>
          For questions, issues, or feature requests, please refer to the application 
          documentation or contact the development team.
        </p>
      </section>
    </div>
  );
};

export default AboutPage;
