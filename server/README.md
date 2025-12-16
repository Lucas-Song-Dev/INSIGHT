# Reddit Painpoint Analyzer - Server

Flask-based REST API for scraping Reddit and analyzing user pain points with software products. Features JWT authentication, MongoDB integration, and Anthropic Claude analysis.

## Tech Stack

- **Flask 3.0** - Web framework
- **Flask-RESTful** - REST API framework
- **MongoDB** - Database for data persistence
- **PRAW** - Reddit API wrapper
- **Anthropic Claude API** - Advanced pain point analysis
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **NLTK** - Natural language processing

## Prerequisites

- **Python 3.9+**
- **MongoDB** (local or cloud instance)
- **Reddit API credentials** (optional, for scraping)
- **Anthropic API key** (optional, for advanced analysis)

## Local Development Setup

### 1. Create Virtual Environment

```bash
python -m venv venv
```

**Windows:**
```bash
.\venv\Scripts\Activate.ps1
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 2. Install Dependencies

This project uses `uv` as the package manager. Install dependencies with:

```bash
uv sync
```

If you don't have uv installed:
```bash
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

For development dependencies (including pytest):
```bash
uv sync --extra dev
```

### 3. Environment Configuration

Create a `.env` file in the `server` directory:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/reddit_scraper

# JWT Configuration
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ACCESS_TOKEN_EXPIRES=3600

# Reddit API (Optional)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# OpenAI API (Optional)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Admin Fallback (if MongoDB unavailable)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password
```

**Important:** Never commit `.env` files to version control. Use strong, unique values for production.

### 4. MongoDB Setup

#### Local MongoDB

1. **Install MongoDB**
   - Windows: Download from [mongodb.com](https://www.mongodb.com/try/download/community)
   - Linux: `sudo apt-get install mongodb`
   - Mac: `brew install mongodb-community`

2. **Start MongoDB**
   ```bash
   # Windows
   net start MongoDB
   
   # Linux/Mac
   sudo systemctl start mongod
   ```

3. **Verify Connection**
   - Default connection: `mongodb://localhost:27017/reddit_scraper`
   - Update `MONGODB_URI` in `.env` if using different settings

#### MongoDB Atlas (Cloud)

1. Create account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster (free tier available)
3. Get connection string from "Connect" → "Connect your application"
4. Update `MONGODB_URI` in `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/reddit_scraper
   ```

### 5. Run the Server

**With Auto-Reload (Development):**
```bash
python main.py
```
This will start the server with `debug=True`, which enables:
- Auto-reload on file changes
- Detailed error messages
- Interactive debugger

**Alternative: Using Flask CLI:**
```bash
flask run --host=0.0.0.0 --port=5000 --debug
```

**Production Mode (No Auto-Reload):**
```bash
# Set debug=False in main.py, then:
python main.py
```

The server will start on `http://localhost:5000`

### 6. Verify Installation

Test the API:

```bash
# Check status (requires auth)
curl http://localhost:5000/api/status

# Register a user
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

## API Endpoints

See the main [API Documentation](#api-endpoints) section below for complete endpoint details.

### Quick Reference

- `POST /api/register` - Register new user
- `POST /api/login` - Authenticate and get JWT token
- `POST /api/logout` - Logout
- `POST /api/scrape` - Start Reddit scraping job (auth required)
- `GET /api/posts` - Get scraped posts (auth required)
- `GET /api/pain-points` - Get analyzed pain points (auth required)
- `GET /api/status` - Get system status (auth required)

## Digital Ocean Deployment

### Option 1: App Platform (Recommended)

1. **Connect Repository**
   - Go to Digital Ocean App Platform
   - Connect your GitHub/GitLab repository
   - Select the `server` folder as the root

2. **Configure Build Settings**
   - **Build Command:** `uv sync`
   - **Run Command:** `uv run gunicorn main:app --bind 0.0.0.0:$PORT`
   - **Environment Variables:** Add all variables from your `.env` file

3. **Set Environment Variables**
   ```
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET_KEY=your-production-secret-key
   REDDIT_CLIENT_ID=...
   REDDIT_CLIENT_SECRET=...
   ANTHROPIC_API_KEY=...
   ```

4. **Deploy**
   - Digital Ocean will automatically build and deploy
   - The API will be available at your assigned domain

### Option 2: Droplet with Gunicorn + Nginx

1. **Create Droplet**
   - Ubuntu 22.04 LTS recommended
   - Minimum 1GB RAM, 1 vCPU

2. **SSH into Droplet**
   ```bash
   ssh root@your-droplet-ip
   ```

3. **Install System Dependencies**
   ```bash
   sudo apt-get update
   sudo apt-get install -y python3-pip python3-venv nginx git
   ```

4. **Clone Repository**
   ```bash
   git clone <your-repo-url>
   cd RedditPainpoint/server
   ```

5. **Install Dependencies**
   ```bash
   # Install uv if not already installed
   curl -LsSf https://astral.sh/uv/install.sh | sh
   
   # Install project dependencies
   uv sync
   ```

6. **Create Environment File**
   ```bash
   nano .env
   # Add all your environment variables
   ```

7. **Test Application**
   ```bash
   uv run gunicorn main:app --bind 0.0.0.0:5000
   # Test in another terminal: curl http://localhost:5000/api/status
   ```

8. **Create Systemd Service**
   ```bash
   sudo nano /etc/systemd/system/reddit-api.service
   ```

   Add this configuration:
   ```ini
   [Unit]
   Description=Reddit Painpoint API
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/root/RedditPainpoint/server
   Environment="PATH=/root/RedditPainpoint/server/venv/bin"
   ExecStart=/root/.local/bin/uv run gunicorn main:app --bind 127.0.0.1:5000 --workers 4
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

9. **Start Service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable reddit-api
   sudo systemctl start reddit-api
   sudo systemctl status reddit-api
   ```

10. **Configure Nginx**
    ```bash
    sudo nano /etc/nginx/sites-available/api
    ```

    Add this configuration:
    ```nginx
    server {
        listen 80;
        server_name your-api-domain.com;

        location / {
            proxy_pass http://127.0.0.1:5000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```

11. **Enable Site and Restart Nginx**
    ```bash
    sudo ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```

12. **Set Up SSL with Let's Encrypt**
    ```bash
    sudo apt-get install certbot python3-certbot-nginx
    sudo certbot --nginx -d your-api-domain.com
    ```

13. **Configure Firewall**
    ```bash
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw enable
    ```

### Option 3: Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM python:3.11-slim

   WORKDIR /app

   # Install uv
   COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

   # Copy dependency files
   COPY pyproject.toml uv.lock ./

   # Install dependencies
   RUN uv sync --frozen

   # Copy application code
   COPY . .

   EXPOSE 5000

   CMD ["uv", "run", "gunicorn", "main:app", "--bind", "0.0.0.0:5000", "--workers", "4"]
   ```

2. **Build and Run**
   ```bash
   docker build -t reddit-api .
   docker run -d -p 5000:5000 --env-file .env reddit-api
   ```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGODB_URI` | Yes | MongoDB connection string | `mongodb://localhost:27017/reddit_scraper` |
| `JWT_SECRET_KEY` | Yes | Secret key for JWT tokens | `your-secret-key` |
| `JWT_ACCESS_TOKEN_EXPIRES` | No | Token expiry in seconds | `3600` (default) |
| `REDDIT_CLIENT_ID` | No | Reddit API client ID | `your_reddit_client_id` |
| `REDDIT_CLIENT_SECRET` | No | Reddit API secret | `your_reddit_client_secret` |
| `ANTHROPIC_API_KEY` | No | Anthropic API key | `sk-ant-...` |
| `ADMIN_USERNAME` | No | Fallback admin username | `admin` |
| `ADMIN_PASSWORD` | No | Fallback admin password | `password` |

## Current Configuration

- **Port:** 5000 (development), 8080 (production with Gunicorn)
- **Database:** MongoDB (configured via `MONGODB_URI`)
- **Authentication:** JWT tokens in HTTP-only cookies
- **CORS:** Configured for `http://localhost:5173` (update for production)

## API Endpoints

### Authentication

#### Register User
```
POST /api/register
Content-Type: application/json

{
  "username": "string",
  "password": "string",
  "email": "string" (optional)
}
```

#### Login
```
POST /api/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response includes HTTP-only cookie with JWT token
```

#### Logout
```
POST /api/logout
```

### Data Collection

#### Scrape Reddit Posts
```
POST /api/scrape
Authorization: Required

{
  "products": ["string"],
  "limit": 100,
  "subreddits": ["string"],
  "time_filter": "month",
  "use_openai": true
}
```

#### Get Posts
```
GET /api/posts?product=string&limit=100&sort_by=date
Authorization: Required
```

#### Get Pain Points
```
GET /api/pain-points?product=string&min_severity=0.5
Authorization: Required
```

#### Get Status
```
GET /api/status
Authorization: Required
```

See the full API documentation in the codebase for complete endpoint details.

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB is running: `sudo systemctl status mongod`
- Check connection string format
- Ensure MongoDB allows connections from your IP (for cloud instances)

### Authentication Issues
- Verify JWT_SECRET_KEY is set
- Check cookie settings (httponly, secure, samesite)
- Ensure CORS is properly configured

### Reddit API Issues
- Verify Reddit credentials are correct
- Check rate limits (Reddit has strict limits)
- Ensure user agent is set (handled by PRAW)

### Anthropic API Issues
- Verify API key is valid
- Check API quota/limits
- Ensure proper error handling in code

## Development Notes

- Uses Flask-RESTful for clean API structure
- JWT tokens stored in HTTP-only cookies for security
- MongoDB used for persistence, falls back to in-memory if unavailable
- Background threads used for long-running scraping jobs
- NLTK used for sentiment analysis and topic extraction

## License

MIT License
