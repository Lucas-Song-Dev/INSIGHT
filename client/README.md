# Reddit Painpoint Analyzer - Client

React-based frontend application for analyzing Reddit pain points. Features a terminal/hardware aesthetic with black and green color scheme.

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Axios** - HTTP client for API requests
- **SCSS** - Styling with terminal theme
- **React Context API** - State management for auth and notifications

## Prerequisites

- **Node.js** 18+ and npm (or yarn/pnpm)
- Access to the backend API server

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

**Create a `.env` file in the `client` directory:**

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

**Important:** 
- The `.env` file must be in the `client` folder (same level as `package.json`)
- The API base URL should point to your backend server
- For local development: `http://localhost:5000/api`
- **Restart the dev server** after creating/updating `.env` file

**If you get `undefined/register` errors:**
- Check that `.env` file exists in the `client` folder
- Verify the variable name is exactly `VITE_API_BASE_URL` (must start with `VITE_`)
- Restart the dev server: Stop (Ctrl+C) and run `npm run dev` again

### 3. Start Development Server

```bash
npm run dev
```

The application will start on `http://localhost:5173` (default Vite port).

### 4. Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

### 5. Preview Production Build

```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm test` - Run tests with Vitest
- `npm run test:coverage` - Run tests with coverage report

## Project Structure

```
client/
├── src/
│   ├── api/              # API client functions
│   ├── components/        # Reusable React components
│   ├── context/          # React Context providers
│   ├── pages/            # Page components
│   ├── styles/           # SCSS variables and themes
│   └── main.jsx          # Application entry point
├── public/               # Static assets
├── .env                  # Environment variables (create this)
└── package.json
```

## Digital Ocean Deployment

### Option 1: Static Site Hosting (Recommended)

The client is a static React app that can be deployed to any static hosting service.

#### Using Digital Ocean App Platform

1. **Connect Repository**
   - Go to Digital Ocean App Platform
   - Connect your GitHub/GitLab repository
   - Select the `client` folder as the root

2. **Configure Build Settings**
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `dist`
   
   **Note:** Make sure `package-lock.json` is committed to the repository. If you've updated dependencies, regenerate it locally with `npm install` before deploying.
   - **Environment Variables:**
     ```
     VITE_API_BASE_URL=https://your-api-domain.com/api
     ```

3. **Deploy**
   - Digital Ocean will automatically build and deploy
   - The app will be available at your assigned domain

#### Using Digital Ocean Spaces (Static Hosting)

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Upload to Spaces**
   - Create a Digital Ocean Space
   - Enable static site hosting
   - Upload the contents of the `dist` folder
   - Set index document to `index.html`

3. **Configure CDN** (Optional)
   - Enable CDN on your Space for faster global delivery

### Option 2: Using Nginx on Droplet

1. **SSH into your Droplet**
   ```bash
   ssh root@your-droplet-ip
   ```

2. **Install Node.js and npm**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone and Build**
   ```bash
   git clone <your-repo-url>
   cd RedditPainpoint/client
   npm install
   npm run build
   ```

4. **Install and Configure Nginx**
   ```bash
   sudo apt-get update
   sudo apt-get install nginx
   
   # Create nginx config
   sudo nano /etc/nginx/sites-available/client
   ```

5. **Nginx Configuration**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       root /path/to/RedditPainpoint/client/dist;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       # Cache static assets
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

6. **Enable Site and Restart Nginx**
   ```bash
   sudo ln -s /etc/nginx/sites-available/client /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Set Up SSL with Let's Encrypt** (Recommended)
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000/api` |

## Current Configuration

- **Development Server:** `http://localhost:5173`
- **API Endpoint:** Configured via `VITE_API_BASE_URL`
- **Build Output:** `dist/` directory
- **Theme:** Terminal/Hardware aesthetic (black/green)

## Troubleshooting

### CORS Issues
If you encounter CORS errors, ensure:
- Backend CORS is configured to allow your frontend origin
- `VITE_API_BASE_URL` matches your backend server URL

### Authentication Issues
- Ensure cookies are enabled in your browser
- Check that the backend is running and accessible
- Verify `VITE_API_BASE_URL` is correct

### Build Errors
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)

## Development Notes

- The app uses React Context for authentication state
- All API calls include `withCredentials: true` for cookie-based auth
- Terminal theme uses monospace fonts and green-on-black color scheme
- Components are organized by feature/page

## License

MIT License
