# Frontend Deployment to Vercel

This guide covers deploying the TokenWatch frontend as a standalone repository to Vercel.

## Prerequisites

- Vercel account
- GitHub repository for the frontend
- Deployed backend (Heroku recommended)
- Backend URL from Heroku deployment (e.g., `https://tokenwatch-api.herokuapp.com`)

## Architecture

When deployed to Vercel:
- **Repository**: Frontend as standalone root directory
- **Build System**: Vite with React
- **Output**: Static SPA in `dist/` directory
- **Environment**: Configured via Vercel Dashboard environment variables
- **Backend URL**: Set via `VITE_TOKENWATCH_API_URL` variable

## Step 1: Connect GitHub Repository

### Option A: Through Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Select your frontend repository
5. Choose root directory: Select `./` (repository root for standalone frontend)
6. Continue to environment variables step

### Option B: Import Existing Project

```bash
# If you don't have a Vercel account yet
npm i -g vercel
vercel
```

## Step 2: Configure Project Settings

### Build Configuration

Vercel should auto-detect these settings from `vercel.json`:

| Setting | Value |
|---------|-------|
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Framework | Vite |

These are already configured in `vercel.json` in the repository.

## Step 3: Set Environment Variables

### In Vercel Dashboard:

1. Go to Project Settings → Environment Variables
2. Add the following variable:

**Production**:
```
VITE_TOKENWATCH_API_URL = https://your-heroku-app.herokuapp.com
```

**Preview** (for pull requests):
```
VITE_TOKENWATCH_API_URL = https://your-heroku-staging-app.herokuapp.com
```

**Development** (optional, usually uses localhost):
Leave empty (frontend will use localhost:3001 fallback)

### Environment Variable Naming

- Vite exposes variables prefixed with `VITE_` to the browser
- Other variables are only available at build time
- Use only `VITE_TOKENWATCH_API_URL` for frontend-backend connection

### Example Configuration in Vercel Dashboard

| Name | Value | Environments |
|------|-------|----------------|
| `VITE_TOKENWATCH_API_URL` | `https://tokenwatch-api.herokuapp.com` | Production, Preview |

## Step 4: Deploy

### Automatic Deployment

Once connected to GitHub, Vercel automatically deploys when you push to the main branch:

```bash
# Push your code
git push origin main

# Vercel will automatically:
# 1. Detect changes
# 2. Install dependencies (npm install)
# 3. Build the project (npm run build)
# 4. Deploy to production
# 5. Generate unique URLs for preview and production
```

### Manual Deployment

```bash
# Deploy current branch
vercel

# Deploy to production
vercel --prod

# Deploy specific directory (if not in project root)
vercel --cwd ./frontend --prod
```

## Step 5: Verify Deployment

### Check Deployment Status

1. Go to Vercel Dashboard
2. Click your project
3. View recent deployments
4. Check build logs for errors

### Test Frontend

```bash
# Should load your site
curl https://your-project.vercel.app/

# Check that it can reach backend
curl https://your-project.vercel.app/api/health
# (This will be proxied through frontend)
```

### Test Backend Connectivity

In browser console at `https://your-project.vercel.app`:

```javascript
// Check API base URL
console.log(window.__API_BASE_URL || 'not set')

// Test health endpoint
fetch(`${import.meta.env.VITE_TOKENWATCH_API_URL}/api/health`)
  .then(r => r.json())
  .then(d => console.log('Backend status:', d.status))
  .catch(e => console.error('Backend unreachable:', e))
```

### Test Application Flow

1. Navigate to `https://your-project.vercel.app`
2. Sign up with a test email
3. Verify email works (check backend logs)
4. Create a workspace
5. Generate API key
6. Copy API endpoint code
7. Test telemetry ingestion

## Project Structure

When deployed as standalone, the frontend root contains:

```
frontend/
├── src/                 # React components and pages
├── public/             # Static files
├── dist/               # Build output (Vercel deploys this)
├── index.html          # Entry point
├── vite.config.ts      # Vite configuration
├── vercel.json         # Vercel configuration ✓
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── .env.example        # Environment template
└── README.md           # Documentation
```

The `vercel.json` file tells Vercel:
- How to build: `npm run build`
- Where output is: `dist/`
- Which env variables to expose: `VITE_TOKENWATCH_API_URL`

## API Wiring

The frontend automatically configures the backend URL via:

**File**: `src/lib/api.ts`

```typescript
function resolveApiBaseUrl(): string {
  // 1. Check environment variable first
  if (import.meta.env.VITE_TOKENWATCH_API_URL) {
    return import.meta.env.VITE_TOKENWATCH_API_URL;
  }

  // 2. For localhost development
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://${hostname}:3001`;
    }
  }

  // 3. Fallback
  return "http://localhost:3001";
}
```

**Priority**:
1. Production (Vercel): Uses `VITE_TOKENWATCH_API_URL` → Heroku backend
2. Local dev: Uses `localhost:3001`
3. Fallback: Uses `localhost:3001`

All frontend API calls use this centralized `API_BASE_URL` constant.

## Monitoring & Troubleshooting

### Build Failures

```bash
# View build logs in Vercel Dashboard:
# Project → Deployments → [Failed Deployment] → Logs
```

Common build errors:

**Error**: `Cannot find module '@/components/...'`
- **Fix**: Ensure all TypeScript paths are correct in `tsconfig.json`

**Error**: `VITE_TOKENWATCH_API_URL is undefined`
- **Fix**: Add `VITE_TOKENWATCH_API_URL` in Vercel environment variables

**Error**: `Failed to parse dependency`
- **Fix**: Verify `package.json` has valid syntax and all dependencies install locally

### Runtime Issues

**Issue**: Frontend works but can't reach backend

**Debug**:
```javascript
// In browser console
console.log('API Base URL:', import.meta.env.VITE_TOKENWATCH_API_URL)
fetch(`${import.meta.env.VITE_TOKENWATCH_API_URL}/api/health`)
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

**Solutions**:
1. Verify `VITE_TOKENWATCH_API_URL` is set in Vercel dashboard
2. Verify backend is running and accessible
3. Check browser CORS errors in console
4. Verify backend `CORS_ORIGIN` includes your Vercel domain

**Issue**: Blank page or 404

**Debug**:
```bash
# Check that build output is correct
npm run build
ls -la dist/
```

**Solution**:
- Verify `index.html` is in `dist/`
- Check `vercel.json` has `"outputDirectory": "dist"`

### Environment Variable Issues

**Issue**: Environment variable not available in frontend code

**Solution**: 
- Only `VITE_*` prefixed variables are exposed to browser
- Check spelling: `VITE_TOKENWATCH_API_URL` (not `TOKENWATCH_API_URL`)
- Rebuild after changing variables in Vercel

**Verify variable is set**:
```bash
# In browser console
console.log(import.meta.env.VITE_TOKENWATCH_API_URL)
```

## Continuous Deployment

### Auto-Deploy on Push

```bash
# Push to main branch
git push origin main

# Vercel automatically builds and deploys
# Check status in Vercel dashboard
```

### Preview Deployments

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and push
git push origin feature/my-feature

# Vercel creates preview URL automatically
# Check Vercel dashboard for preview link
```

### Staging Environment

To keep staging separate from production:

```bash
# Create staging branch
git checkout -b staging

# Deploy to staging URL
git push origin staging
```

Then in Vercel dashboard:
- Create separate project for staging branch
- OR use different environment variables per branch

## Performance Optimization

### Current Build Output

- **Total Size**: ~600KB gzipped
- **CSS**: ~12KB gzipped
- **JavaScript**: ~125KB gzipped
- **Number of chunks**: 10

### Verify Optimization

```bash
# Check bundle size
npm run build

# Output shows file sizes:
# dist/index.html          4.5 KiB
# dist/assets/index-xxx.js 125.9 KiB / 396.2 KiB
# dist/assets/index-xxx.css 12.7 KiB / 72.4 KiB
```

### Optimization Tips

- Code splitting via React Router ✓ (already implemented)
- Tree shaking via Vite ✓ (automatic)
- Lazy loading components ✓ (already implemented)
- Image optimization: Add `next/image` if needed

## Deployment Checklist

Before deploying to production:

- [ ] Backend deployed and running (HEROKU_DEPLOY.md)
- [ ] Backend health endpoint accessible
- [ ] Frontend repository connected to Vercel
- [ ] Environment variable set: `VITE_TOKENWATCH_API_URL`
- [ ] Build succeeds locally: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] ESLint passes: `npm run lint`
- [ ] All imports resolve correctly
- [ ] Backend CORS_ORIGIN includes Vercel domain
- [ ] Application works in browser
  - [ ] Can sign up
  - [ ] Can log in
  - [ ] Can create workspace
  - [ ] Can generate API key
  - [ ] Can view analytics
- [ ] Mobile responsive
- [ ] No console errors
- [ ] No broken links

## Rollback

### If Deployment Fails

1. Go to Vercel dashboard
2. Click your project
3. View deployments
4. Find the last successful deployment
5. Click "Promote to Production"

### Manual Rollback

```bash
# Check deployment history
git log --oneline

# Checkout previous version
git checkout <commit-hash>

# Push to deploy previous version
git push origin main --force-with-lease
```

## Domain Configuration

### Custom Domain

1. Go to Vercel dashboard → Project → Settings → Domains
2. Add your custom domain (e.g., `app.example.com`)
3. Update DNS records at your domain registrar
4. Vercel provides DNS records to add
5. Wait for DNS propagation (5-10 minutes)

### Subdomain

```
vercel.json already configured for automatic deployment.
No additional setup needed.
```

## Environment-Specific Configurations

### Development

```bash
# Run locally with backend at localhost:3001
VITE_TOKENWATCH_API_URL=http://localhost:3001 npm run dev
```

### Staging

In Vercel dashboard for staging project:
```
VITE_TOKENWATCH_API_URL=https://staging-backend.herokuapp.com
```

### Production

In Vercel dashboard for production project:
```
VITE_TOKENWATCH_API_URL=https://tokenwatch-api.herokuapp.com
```

## Monitoring

### Error Tracking

Set up error tracking via Vercel integrations:
- Sentry
- LogRocket
- Datadog

### Analytics

Track user interactions:
- Google Analytics
- Mixpanel
- Segment

### Performance Monitoring

Vercel provides:
- Build times
- Core Web Vitals
- Deployment statistics

## Cost Optimization

- **Hobby Plan**: Free tier sufficient for development
- **Pro Plan**: $20/month, recommended for production
- **Enterprise**: Custom pricing

## Security

### Best Practices:

1. **Environment Variables**: Never commit sensitive data
2. **HTTPS**: Enabled automatically by Vercel
3. **CORS**: Backend validates origin
4. **API Keys**: Never expose API keys to frontend
5. **Secrets**: Only store in Vercel dashboard
6. **Regular Updates**: Keep dependencies up to date

## Support & Documentation

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## Next Steps

1. ✅ Deploy frontend to Vercel (this guide)
2. ✅ Deploy backend to Heroku (see HEROKU_DEPLOY.md)
3. 🔗 Verify frontend-backend connection works
4. 🧪 Run integration tests against deployed instances
5. 📊 Set up monitoring and alerting
6. 🎯 Configure custom domain
