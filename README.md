# INSIGHT Analyzer

A comprehensive platform for analyzing user discussions and generating actionable insights using advanced NLP and AI-powered analysis. Transform user feedback into strategic product improvements.

## 🚀 Features

### Core Functionality
- **AI-Powered Discovery**: Automatically find and analyze relevant discussions using Claude AI
- **Advanced NLP Analysis**: Sentiment analysis with 94% accuracy using state-of-the-art models
- **Insight Detection**: Identify and categorize user pain points and feedback patterns
- **Smart Recommendations**: Generate actionable recommendations using Claude AI
- **Credits System**: Fair usage system with credit-based operations
- **Real-time Dashboard**: Monitor analysis progress and results

### User Experience
- **Professional UI**: Modern, clean interface with excellent readability
- **Error Boundaries**: Robust error handling to prevent crashes
- **Responsive Design**: Works seamlessly on desktop and mobile
- **User Profiles**: Track credits and usage history
- **Comprehensive Testing**: Extensive test coverage for reliability

## 🛠 Tech Stack

### Backend
- **Python 3.8+** with Flask and Flask-RESTful
- **MongoDB** for scalable data storage
- **Reddit API** for discussion collection
- **Claude AI (Anthropic)** for advanced analysis and recommendations
- **Advanced NLP Pipeline** with spaCy, transformers, and custom models
- **JWT Authentication** with secure cookie-based sessions
- **Rate Limiting** and security middleware

### Frontend
- **React 18** with modern hooks and context
- **Vite** for fast development and building
- **SCSS** with professional design system
- **Axios** for API communication
- **Vitest** for comprehensive testing
- **Error Boundaries** for graceful error handling

## 📚 Documentation

Project documentation lives in the [**documentation/**](documentation/) folder. When you update any document there, add at the top the **date** (YYYY-MM-DD) and the **git commit** that introduced the change so documentation stays traceable and up to date.

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- MongoDB instance (local or cloud)
- Reddit API credentials
- Claude API key (Anthropic)

## 🚀 Quick Start

### Backend Setup

1. **Navigate to server directory**:
```bash
cd server
```

2. **Install dependencies** (using uv):
```bash
uv sync
```

If you don't have uv installed, install it first:
```bash
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

3. **Configure environment variables** in `.env`:
```env
# Reddit API
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# Claude AI
ANTHROPIC_API_KEY=your_claude_api_key

# Database
MONGODB_URI=mongodb://localhost:27017/insight_analyzer

# Security
JWT_SECRET_KEY=your_secure_jwt_secret_key_minimum_32_chars
JWT_ACCESS_TOKEN_EXPIRES=3600

# Optional: Admin credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_admin_password
```

4. **Start the server**:
```bash
python app.py
```

The backend will be available at `http://localhost:5000`

### Frontend Setup

1. **Navigate to client directory**:
```bash
cd client
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment variables** in `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

4. **Start development server**:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 💡 How to Use

### 1. Getting Started
- **Register**: Create a new account (receives 5 credits automatically)
- **Login**: Access your dashboard and view your credit balance

### 2. Discover Insights
- Navigate to "Find Insights"
- Enter a topic or product name (e.g., "React", "JavaScript", "VS Code")
- Select analysis scope (time period and discussion limit)
- **Note**: Operations cost credits based on scope and complexity

### 3. View Results
- Browse all analyzed products in the "Results" section
- Filter and search through discovered insights
- View discussion details, sentiment analysis, and identified patterns

### 4. Explore Product Details
- Click any product to view comprehensive analysis
- **Discussions Tab**: All collected discussions with metadata
- **Analysis Tab**: AI-generated insights and pain point categorization
- **Recommendations Tab**: Actionable improvement suggestions

### 5. Manage Your Account
- Click your profile to view credit balance and usage history
- Monitor your analysis history and results

## 📦 Data storage (MongoDB)

All data is stored in the MongoDB database named in `MONGODB_URI` (e.g. `reddit_scraper`). Key collections:

| Collection | Purpose |
|------------|--------|
| **posts** | Scraped Reddit posts; `product` = topic/product name from the scrape job. |
| **jobs** | Scrape and analysis jobs (status, logs, parameters, results). |
| **anthropic_analysis** | Full Claude analysis per product: `_id` = normalized product name (lowercase), document includes `analysis` (common_pain_points, analysis_summary, etc.) and `created_at`. |
| **pain_points** | Individual pain points; each doc has `product`, `topic` (pain point name), `description`, `severity`, etc. |
| **recommendations** | Saved recommendations per product; `_id` / `product` and `recommendations` array. |
| **users** | User accounts, credits, auth data. |
| **metadata** | Scraper metadata (e.g. scrape_in_progress). |

Analysis flow: **run-analysis** loads posts → Claude extracts pain points → results are written to **anthropic_analysis** and **pain_points**; then (unless `skip_recommendations`) recommendations are generated and written to **recommendations**.

## 🔧 API Reference

### Authentication
```http
POST /api/register    # Register new user
POST /api/login       # User authentication
POST /api/logout      # Secure logout
```

### User Management
```http
GET  /api/user/profile     # Get user profile and credits (fixed: proper Flask-RESTful Resource handling)
POST /api/user/credits     # Update user credits (admin)
```

**Note**: The user profile endpoint has been fixed to properly handle Flask-RESTful Resource methods with comprehensive logging for debugging.

### Analysis Operations
```http
POST /api/scrape           # Start insight discovery (costs credits)
GET  /api/posts           # Retrieve discussions with filters
GET  /api/pain-points     # Get identified pain points
POST /api/run-analysis    # Run AI analysis (creates job). Body: { product, max_posts?, skip_recommendations? }
GET  /api/claude-analysis # Get AI analysis results
```
- **run-analysis** options: `product` (required), `max_posts` (optional, 1–1000, default 500), `skip_recommendations` (optional, boolean; if true, only pain-point analysis is run and recommendations are not generated).

### Recommendations
```http
GET  /api/recommendations  # Get saved recommendations
POST /api/recommendations  # Generate new recommendations
```

### System
```http
GET /api/status           # System status and statistics
GET /api/all-products     # List all analyzed products
```

## 🧪 Testing

### Backend Tests
```bash
cd server
python -m pytest tests/ -v --cov=. --cov-report=html
```

### Frontend Tests
```bash
cd client
npm test                  # Run tests
npm run test:coverage     # Run with coverage
npm run test:ui          # Run with UI
```

### Comprehensive Testing
```bash
cd server
python run_comprehensive_tests.py
```

## 🎨 Design System

The application uses a modern dark theme with rounded aesthetics:

- **Typography**: System font stack (Inter, Segoe UI, Roboto) with optimized weights
- **Color Scheme**: Modern dark theme with indigo accents
  - Deep slate backgrounds (#0f172a, #1e293b, #334155)
  - Indigo accent colors (#6366f1) for interactive elements
  - High contrast text for excellent readability
- **Components**: Rounded corners (12px-20px), smooth animations, clean edges
- **Animations**: Smooth transitions using cubic-bezier easing functions
- **No Glows**: Clean, modern aesthetic without glow effects (except parallax)
- **Accessibility**: WCAG compliant with proper focus management
- **Responsive**: Mobile-first design with breakpoints

## 💳 Credits System

### How Credits Work
- **New Users**: Receive 5 credits upon registration
- **Cost Structure**: Based on analysis scope and complexity
  - Small analysis (≤50 discussions, week): 2 credits
  - Medium analysis (≤100 discussions, month): 6 credits
  - Large analysis (≤200 discussions, year): 12 credits
  - Comprehensive analysis (200+ discussions, all time): 20 credits

### Credit Management
- View balance in navigation sidebar
- Track usage in user profile
- Admins can adjust credits via API

## 🚀 Deployment

### Backend (Heroku/Railway)
1. Create application on platform
2. Set all environment variables
3. Deploy using Git integration
4. Ensure MongoDB connection is configured

### Frontend (Netlify/Vercel)
1. Build the project: `npm run build`
2. Deploy the `dist` folder
3. Set `VITE_API_BASE_URL` to your backend URL
4. Configure redirects for SPA routing

### Environment Variables Checklist
- [ ] `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `MONGODB_URI`
- [ ] `JWT_SECRET_KEY` (minimum 32 characters)
- [ ] `VITE_API_BASE_URL` (frontend)

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes with tests
4. **Test** thoroughly: `npm test` and `pytest`
5. **Commit** with clear messages
6. **Push** and create a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs or request features via GitHub Issues
- **Documentation**: Check the [documentation/](documentation/) folder for detailed guides and test oracles
- **API**: Use the built-in API documentation at `/api/docs`

---

**Built with ❤️ for better user insights and product development**