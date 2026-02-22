# INSIGHT Analyzer

A comprehensive platform for analyzing user discussions and generating actionable insights using advanced NLP and AI-powered analysis. Transform user feedback into strategic product improvements.

## 🚀 Features

### Discovery & Scraping
- **Find Insights**: Start Reddit discovery by topic/product or by custom prompt (e.g. market gaps, pain points in a niche). Cost in credits shown before submitting.
- **AI-suggested strategy**: Claude suggests subreddits and search queries for your topic or custom prompt.
- **Scrape jobs**: Runs asynchronously; track status, logs, and results per job. Cancel in-flight jobs.
- **Posts from DB**: Analysis uses stored Reddit posts (MongoDB). Posts are indexed by product and subreddit; no Reddit calls during analysis.

### Analysis & Insights
- **Run analysis**: For a product, run Claude-powered analysis on its posts. Produces a summary plus **three synthesized pain points** (group-level, in-depth descriptions with user voice). Optionally skip recommendations.
- **Regenerate analysis**: Clear existing analysis and re-run for 1 credit. Confirmation modal explains cost and clearing; credit refunded if the job fails.
- **Pain points**: Name, severity, in-depth description (with representative quotes), potential solutions, related keywords. No post/upvote counts shown.
- **Recommendations**: AI-generated recommendations tied to pain points; stored per product and user.

### User & Data Scope
- **User-scoped products**: Product list comes from the current user’s jobs only (no cross-user visibility).
- **User-scoped analysis**: Analysis and recommendations are stored with `user_id`; each user sees only their own.
- **Credits**: New users get 5 credits. Scrape and regenerate consume credits; failed jobs refund credits where applicable.
- **Profile**: View credits, update profile; delete account; password reset and change.

### Jobs & Status
- **Jobs list**: View your scrape and analysis jobs, filter by status, open job details and logs.
- **Job details**: Status, parameters, logs, and results (e.g. posts count, products found) per job.
- **Cancel job**: Cancel a running job via API; credits refunded for cancelled scrape/analysis as configured.
- **Status**: System/API status and whether the current user has an active scrape.

### Frontend & UX
- **Pages**: Find Insights (scrape), Products/Results, Product Detail (Discussions, Analysis, Recommendations), Jobs, Job Detail, Status, Profile, About, Info.
- **Design system**: Dark theme, global SCSS variables, minimal aesthetic, accessible components.
- **Error boundaries**: Graceful handling of React errors to avoid full-app crashes.
- **Notifications**: Toasts for success, error, and info (e.g. analysis started, insufficient credits).
- **Responsive layout**: Sidebar navigation, works on desktop and mobile.

### Security & API
- **JWT auth**: Login/logout with HTTP-only cookies; protected routes require authentication.
- **CORS**: Configured for allowed origins (e.g. dev frontend).
- **Rate limiting**: Applied where configured to protect APIs.

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
- **Register**: Create a new account (receives 5 credits automatically).
- **Login**: Access your dashboard; credit balance is shown in the sidebar.

### 2. Discover Insights
- Go to **Find Insights**.
- **Product Insights**: Enter a topic or product (e.g. "VS Code", "React"). Estimated credit cost is shown on the button.
- **Custom Insights**: Switch to the custom tab and describe what you want to discover (e.g. market gaps, pain points); cost is shown before submitting.
- Scrape runs in the background; you can open **Jobs** to see status and logs.

### 3. View Results & Products
- **Products** (or Results): Lists products from **your** jobs only. Click a product to open its detail page.
- **Product Detail**: **Discussions** tab shows scraped posts; **Analysis** tab shows the AI summary and three synthesized pain points (with descriptions, severity, solutions, keywords). **Recommendations** tab shows AI suggestions. Use **Regenerate** to clear and re-run analysis (1 credit; confirmation modal).

### 4. Jobs & Status
- **Jobs**: List of your scrape and analysis jobs; filter by status, open a job for details and logs.
- **Status**: Quick view of system status and whether a scrape is in progress.

### 5. Profile & Account
- **Profile**: View and edit profile, see credit balance and usage.
- **Delete account** and **password** reset/change are available from profile or account endpoints.

## 📦 Data storage (MongoDB)

All data is stored in the MongoDB database named in `MONGODB_URI` (e.g. `reddit_scraper`). Key collections:

| Collection | Purpose |
|------------|--------|
| **posts** | Scraped Reddit posts; `product`, `subreddit`; compound index `(product, subreddit)` for analysis queries. Shared across users. |
| **jobs** | Scrape and analysis jobs; `user_id`, status, parameters, logs, results (e.g. posts_count, products_found). |
| **anthropic_analysis** | Claude analysis per product and user: keyed by `user_id` + product; `analysis` (common_pain_points, analysis_summary, etc.), `created_at`. |
| **pain_points** | Pain points per product and user; `user_id`, `product`, topic, description, severity, potential_solutions, related_keywords. |
| **recommendations** | Recommendations per product and user; `user_id`, `product`, `recommendations` array. |
| **users** | User accounts, credits, auth data. |
| **metadata** | Scraper metadata (e.g. scrape_in_progress). |

Analysis flow: **run-analysis** loads posts from DB (by product, no Reddit call) → Claude synthesizes three pain points and summary → results written to **anthropic_analysis** and **pain_points** with `user_id`; then (unless `skip_recommendations`) recommendations are generated and written to **recommendations**. **Regenerate** clears existing analysis/pain_points/recommendations for that user and product, then runs the same flow (1 credit; refund on failure).

## 🔧 API Reference

### Health & Auth
```http
GET  /api/health          # Health check (no auth)
POST /api/register        # Register new user
POST /api/login           # User authentication (sets HTTP-only cookie)
POST /api/logout           # Secure logout
```

### User & Account
```http
GET    /api/user/profile   # Get profile and credits (auth)
POST   /api/user/credits   # Update user credits (admin)
DELETE /api/user           # Delete account (auth)
PUT    /api/user/password  # Change password (auth)
POST   /api/password/reset-request  # Request password reset
POST   /api/password/reset # Reset password with token
```

### Discovery & Posts
```http
POST /api/scrape           # Start insight discovery (auth; costs credits). Body: topic, limit?, subreddits?, time_filter?, is_custom?, etc.
GET  /api/posts            # Get scraped posts (auth). Query: product?, limit?, sort_by?
GET  /api/status           # System status + user scrape-in-progress (auth)
POST /api/reset-status    # Reset scrape status (admin/dev)
```

### Analysis & Insights
```http
POST /api/run-analysis     # Run AI analysis (auth). Body: product (required), max_posts?, skip_recommendations?, regenerate?
GET  /api/claude-analysis  # Get analysis for a product (auth; user-scoped). Query: product
GET  /api/all-products     # List products from current user's jobs only (auth)
GET  /api/pain-points      # Get pain points (auth). Query: product?, min_severity?
GET  /api/recommendations  # Get recommendations (auth; user-scoped). Query: product
POST /api/recommendations  # Generate recommendations (auth)
```

- **run-analysis**: `product` (required), `max_posts` (optional, 1–1000, default 500), `skip_recommendations` (optional), `regenerate` (optional). If `regenerate: true`, 1 credit is deducted, existing analysis/pain_points/recommendations for that user and product are deleted, then analysis runs (credit refunded on job failure).

### Jobs
```http
GET  /api/jobs             # List current user's jobs (auth). Query: status?
GET  /api/jobs/<job_id>    # Job details and logs (auth)
POST /api/jobs/<job_id>/cancel  # Cancel a running job (auth; may refund credits)
```

### Analytics
```http
GET  /api/analytics        # Status/analytics (auth)
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
- **New users**: Receive 5 credits upon registration.
- **Find Insights (scrape)**: Cost depends on scope (time range, limit); shown on the button before submit. Deducted when the job starts; refunded if the job fails or is cancelled where applicable.
- **Regenerate analysis**: 1 credit per regenerate. Deducted before the job runs; refunded if the analysis job fails.
- **Run analysis** (first time for a product): No extra credit beyond the scrape that collected the posts; analysis runs as a job.

### Credit Management
- View balance in the navigation sidebar and on the Profile page.
- Admins can adjust credits via `POST /api/user/credits`.

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