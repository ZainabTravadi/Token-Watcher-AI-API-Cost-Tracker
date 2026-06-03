# Backend Deployment to Heroku

This guide covers deploying the TokenWatch backend as a standalone repository to Heroku.

## Prerequisites

- Heroku account and CLI installed
- PostgreSQL database provisioned (Neon recommended)
- Git repository for the backend

## Architecture

When deployed to Heroku:
- **Repository**: Backend as standalone root directory
- **Process Types**:
  - `web`: Node.js web server running on PORT
  - `release`: Database schema initialization (runs once per deployment)
- **Database**: PostgreSQL (Neon)
- **Environment**: Configured via Heroku Config Vars

## Step 1: Create Heroku App

```bash
# Create the app
heroku create tokenwatch-api

# View your app URL
heroku open
```

Your backend will be available at: `https://tokenwatch-api.herokuapp.com`

## Step 2: Configure Environment Variables

Set all required environment variables in Heroku:

```bash
# Generate a secure JWT_SECRET (copy the output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set all config variables
heroku config:set \
  NODE_ENV=production \
  DATABASE_URL="postgresql://user:password@host:port/db?sslmode=require" \
  JWT_SECRET="<your-32-char-secret-from-above>" \
  CORS_ORIGIN="https://your-frontend.vercel.app" \
  ENABLE_SIMULATORS=false
```

### Required Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Disables development features |
| `DATABASE_URL` | PostgreSQL connection string | See below for format |
| `JWT_SECRET` | 32+ character random string | Use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate |
| `CORS_ORIGIN` | Your Vercel frontend URL | e.g., `https://app.vercel.app` |
| `ENABLE_SIMULATORS` | `false` | Production should not run simulators |

### PostgreSQL Connection String Format

For **Neon** (recommended):
```
postgresql://user:password@ep-xxxxx.us-east-1.neon.tech/dbname?sslmode=require
```

For **Self-hosted PostgreSQL**:
```
postgresql://user:password@host:5432/dbname
```

### Optional Environment Variables

```bash
# Data retention (in days)
heroku config:set TELEMETRY_RETENTION_DAYS=30

# Enable detailed logging
heroku config:set DEBUG=tokenwatch:*
```

## Step 3: Deploy

### Initial Deployment

```bash
# Add Heroku remote if not already added
git remote add heroku https://git.heroku.com/tokenwatch-api.git

# Deploy
git push heroku main
```

### Watch the Deployment

```bash
# Stream logs
heroku logs --tail
```

The release phase will:
1. Install dependencies
2. Compile TypeScript
3. Initialize PostgreSQL schema (idempotent)
4. Start the web process

### Subsequent Deployments

```bash
# After committing changes
git push heroku main

# View deployment status
heroku logs --tail
```

## Step 4: Verify Deployment

### Health Check

```bash
# Should return 200 OK with status information
curl https://tokenwatch-api.herokuapp.com/api/health | jq .

# Response should include:
# - status: "ok"
# - version info
# - database: "connected"
# - environment: "production"
```

### Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check and diagnostics |
| `/api/auth/signup` | POST | User registration |
| `/api/auth/login` | POST | User login |
| `/api/auth/logout` | POST | User logout |
| `/api/workspaces` | GET | List workspaces |
| `/api/workspaces/:id` | GET | Get workspace details |
| `/api/ingest` | POST | Telemetry ingestion |
| `/api/telemetry/stream` | GET (SSE) | Real-time telemetry stream |
| `/api/analytics/*` | GET | Analytics queries |

### Test Login Flow

```bash
# Sign up
curl -X POST https://tokenwatch-api.herokuapp.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePassword123"}'

# Login
curl -X POST https://tokenwatch-api.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"SecurePassword123"}'

# Verify authenticated request
curl https://tokenwatch-api.herokuapp.com/api/auth/me \
  -b cookies.txt
```

## Monitoring & Logs

### View Logs

```bash
# Real-time logs
heroku logs --tail

# Last 50 lines
heroku logs

# Specific date range
heroku logs --since 1h
```

### Scaling

```bash
# Scale web dynos (default: free tier or hobby)
heroku ps:scale web=1

# Check current scaling
heroku ps
```

### Performance Monitoring

```bash
# View application metrics
heroku metrics

# View database health (if using Heroku Postgres)
heroku pg:info
```

## Troubleshooting

### Application Error (R10)

**Problem**: Procfile not found or invalid

**Solution**: Ensure Procfile exists in repository root and contains:
```
release: npm run db:init
web: npm start
```

### Database Connection Failed

**Problem**: `ECONNREFUSED` or `FATAL: no pg_hba.conf entry`

**Solution**:
1. Verify DATABASE_URL is correctly set: `heroku config:get DATABASE_URL`
2. Check database connection string format
3. Verify database user has correct permissions
4. For Neon, ensure `?sslmode=require` is in the connection string

### Environment Variable Not Found

**Problem**: `Error: environment variable not found`

**Solution**:
```bash
# Check all config vars
heroku config

# Set missing variable
heroku config:set VARIABLE_NAME=value
```

### Release Phase Failure

**Problem**: `npm run db:init` fails during deployment

**Solution**:
1. Check database connection: `heroku config:get DATABASE_URL`
2. View detailed logs: `heroku logs --tail`
3. Ensure PostgreSQL is running and accessible
4. Verify schema doesn't have conflicts

### Port Already in Use

**Problem**: `EADDRINUSE: address already in use :::3001`

**Solution**: Heroku automatically assigns a PORT environment variable. Verify code uses:
```javascript
const port = process.env.PORT || 3001;
app.listen(port);
```

## Deployment Checklist

Before deploying to production:

- [ ] Database provisioned (Neon or PostgreSQL)
- [ ] Environment variables set in Heroku
  - [ ] NODE_ENV=production
  - [ ] DATABASE_URL configured
  - [ ] JWT_SECRET set (32+ characters)
  - [ ] CORS_ORIGIN set to frontend URL
  - [ ] ENABLE_SIMULATORS=false
- [ ] Procfile present in backend root
- [ ] TypeScript builds without errors
- [ ] Database schema initializes successfully
- [ ] Health endpoint responds with 200 OK
- [ ] Authentication tests pass
- [ ] Frontend VITE_TOKENWATCH_API_URL set to backend URL
- [ ] SSL certificate valid (HTTPS)
- [ ] Logs monitored for errors

## Updating After Deployment

### To update code:

```bash
# Commit changes locally
git commit -am "Fix: update backend"

# Deploy
git push heroku main

# Monitor deployment
heroku logs --tail
```

### To update configuration:

```bash
# Update environment variable
heroku config:set VARIABLE_NAME=new_value

# App restarts automatically
heroku logs --tail
```

### To run one-off commands:

```bash
# Run database migrations
heroku run npm run db:init

# Check database state
heroku run node -e "require('pg').connect(process.env.DATABASE_URL, (err, client) => { console.log(err || 'Connected'); client?.end(); })"
```

## Database Management

### Backup Database

```bash
# For Neon, use the Neon dashboard
# For Heroku Postgres:
heroku pg:backups capture
heroku pg:backups download
```

### Initialize Fresh Database

```bash
# WARNING: This destroys existing data
# Only do this for testing

# Connect and reset
heroku run "npm run db:init"
```

## Rollback

If deployment fails:

```bash
# Revert to previous release
heroku releases
heroku rollback

# Verify the rollback
heroku logs --tail
```

## Cost Optimization

- **Free Tier**: Sufficient for testing (limited dyno hours)
- **Hobby Tier**: $5-7/month, good for small production
- **Standard**: $50+/month for production with monitoring

To upgrade:

```bash
heroku dyno:type standard-1x
```

## Security

### Ensure These Best Practices:

1. **Never commit secrets**: Use environment variables only
2. **Use HTTPS**: Heroku provides free HTTPS automatically
3. **Database SSL**: Use `?sslmode=require` in PostgreSQL
4. **JWT Secret**: At least 32 characters, random
5. **CORS Whitelist**: Only allow your frontend domain
6. **Regular backups**: Set up automated backups
7. **Monitor logs**: Watch for suspicious activity

## Support & Documentation

- [Heroku Node.js Documentation](https://devcenter.heroku.com/articles/nodejs-support)
- [Heroku Environment Variables](https://devcenter.heroku.com/articles/config-vars)
- [PostgreSQL on Heroku](https://devcenter.heroku.com/articles/heroku-postgresql)
- [Neon PostgreSQL](https://neon.tech/docs)

## Next Steps

1. ✅ Deploy backend to Heroku (this guide)
2. 📋 Deploy frontend to Vercel (see VERCEL_DEPLOY.md)
3. 🔗 Connect frontend to backend using `VITE_TOKENWATCH_API_URL`
4. 🧪 Run integration tests against deployed instances
5. 📊 Set up monitoring and alerting
