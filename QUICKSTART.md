# TokenWatch: Quick Start Guide

## Prerequisites
- Node.js 18+
- Bun package manager (or npm)
- SQLite (included with better-sqlite3)

## Project Structure
```
token-watcher/
├── backend/          # Express API server
├── frontend/         # React UI
└── sdk/             # Client SDK
```

## Setup & Installation

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Install Frontend Dependencies
```bash
cd frontend
bun install
# or: npm install
```

### 3. Install SDK Dependencies (Optional for local dev)
```bash
cd sdk
npm install
```

## Running the System

### Start Backend Server
```bash
cd backend
npm run dev
# Starts on http://localhost:3001
# Creates/initializes SQLite database automatically
# Hot-reloads on file changes with tsx
```

### Start Frontend Dev Server
```bash
cd frontend
bun dev
# or: npm run dev
# Starts on http://localhost:5173
# Hot Module Replacement (HMR) enabled
```

### Optional: Run Seed Script
```bash
cd backend
npm run seed
# Populates database with demo data
```

## Testing

### Run Complete Test Suite
```bash
cd backend
npm run test:workspace
# Tests user auth, API keys, workspace isolation, and more
```

### Manual API Testing

#### 1. Signup
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -v
# Returns: { user, workspace, apiKey }
# Sets: tokenwatch_auth cookie
```

#### 2. Get Current User
```bash
curl http://localhost:3001/api/auth/me \
  -H "Cookie: tokenwatch_auth=..." \
  -v
# Returns: { user, workspaces[] }
```

#### 3. Ingest Telemetry
```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tw_live_..." \
  -d '{
    "requests": [{
      "route": "POST /api/chat",
      "model": "gpt-4",
      "provider": "openai",
      "status": 200,
      "latency_ms": 500,
      "input_tokens": 100,
      "output_tokens": 50,
      "cost_usd": 0.05
    }]
  }' \
  -v
```

#### 4. Query Analytics
```bash
curl "http://localhost:3001/api/analytics/snapshot?workspaceId=ws_..." \
  -H "Cookie: tokenwatch_auth=..." \
  -v
# Returns: { overview, endpoints[], models[], recent[] }
```

## Frontend Usage

### 1. Navigate to UI
Open http://localhost:5173 in browser

### 2. Sign Up
- Fill in email and password
- Creates user and default workspace automatically
- Redirects to dashboard

### 3. Dashboard Pages
- **Overview**: Budget tracking and top endpoints/models
- **Endpoints**: Detailed endpoint analytics
- **Models**: Model usage and costs
- **Requests**: Real-time telemetry stream
- **Settings**: API key management and workspace config

### 4. Settings
- View and copy API key
- Regenerate API key (old key immediately invalid)
- Edit workspace name, budget, webhook URL
- Configure alert thresholds
- Delete workspace

## SDK Usage Example

```typescript
import TokenWatch from "@tokenwatch/sdk";

// Initialize with workspace credentials
TokenWatch.init({
  apiKey: "tw_live_xxxxx",           // From Settings page
  workspaceId: "ws_yyyyyyy",         // From Settings page
  apiUrl: "http://localhost:3001"
});

// Record API requests
await TokenWatch.recordRequest({
  route: "POST /api/chat",
  model: "gpt-4",
  provider: "openai",
  status: 200,
  latency_ms: 523,
  input_tokens: 150,
  output_tokens: 75,
  cost_usd: 0.0075,
  timestamp: Date.now()
});
```

## Environment Configuration

### Backend (.env or env.ts)
```env
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
DB_PATH=./data/tokenwatch.sqlite
```

### Frontend (.env)
```env
VITE_TOKENWATCH_API_URL=http://localhost:3001
```

## Database

### Auto-Initialization
- Database is created automatically on first backend start
- All tables and indexes created via `applySchema()`
- Located at: `backend/data/tokenwatch.sqlite`

### Inspect Database
```bash
# Use any SQLite client:
sqlite3 backend/data/tokenwatch.sqlite

# List tables:
.tables

# View users:
SELECT id, email, created_at FROM users;

# View workspaces:
SELECT id, user_id, name, created_at FROM workspaces;

# View telemetry:
SELECT route, model, cost_usd, created_at FROM requests LIMIT 10;
```

## Troubleshooting

### Backend Won't Start
```bash
# Check Node version
node --version  # Should be 18+

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check port 3001 is available
lsof -i :3001
```

### Frontend Won't Connect to Backend
```bash
# Check CORS_ORIGIN matches frontend URL
# Default: http://localhost:5173

# Check backend is running on port 3001
curl http://localhost:3001/api/health

# Check browser console for CORS errors
```

### Telemetry Not Showing
1. Verify API key is correct: Settings > API key section
2. Check workspaceId in API call matches Settings page
3. Verify backend received request: Check network tab
4. Check database: `SELECT COUNT(*) FROM requests;`

### API Key Not Working
1. Generate new key: Settings > Regenerate Key button
2. Old key is immediately invalid
3. Use full key format: `tw_live_xxxxxx`
4. Include in X-API-Key header

## Development Workflow

### Adding New Routes
1. Create route file in `backend/src/routes/`
2. Register in `backend/src/core/app.ts`
3. Add auth middleware as needed
4. Use `req.userId` for authenticated requests
5. Use `req.workspaceId` for workspace-filtered queries

### Adding New Frontend Pages
1. Create component in `frontend/src/pages/app/`
2. Import in `frontend/src/App.tsx`
3. Add route: `<Route path="/app/..." element={<ProtectedRoute><MyPage /></ProtectedRoute>} />`
4. Add nav link in `frontend/src/components/AppLayout.tsx`
5. Use `useAuth()` to get workspace context

### Database Schema Changes
1. Update schema in `backend/src/db/schema.ts`
2. Delete `backend/data/tokenwatch.sqlite` to force recreation
3. Or add migration function in `database.ts`

## Performance Tips

### Optimize Queries
- Use indexes on frequently filtered columns
- Limit result sets with LIMIT clause
- Cache with React Query (already configured)

### Monitor Performance
- Check browser DevTools Network tab
- Check server logs for slow queries
- Use `npm run test:workspace` to identify bottlenecks

### Scale for Production
- Use connection pooling (already implemented)
- Configure proper database indexes
- Enable query result caching
- Use CDN for static assets
- Deploy backend and frontend separately

## Security Checklist

- [ ] Set unique JWT_SECRET in production
- [ ] Enable HTTPS in production
- [ ] Set secure cookies in production
- [ ] Configure CORS for your domain only
- [ ] Validate all user inputs on backend
- [ ] Use parameterized queries (already using)
- [ ] Implement rate limiting
- [ ] Monitor API key usage
- [ ] Audit workspace changes
- [ ] Use environment variables for secrets

## Next Steps

1. **Try the Demo**
   - Sign up with test@example.com / password123
   - Explore all dashboard pages
   - Check Settings page

2. **Generate Test Data**
   - Run: `npm run seed` in backend
   - Dashboard will show sample analytics

3. **Integrate SDK**
   - Copy API key from Settings page
   - Initialize SDK in your app
   - Start recording requests

4. **Deploy**
   - Build frontend: `npm run build`
   - Deploy backend Node server
   - Configure environment variables
   - Set CORS_ORIGIN for your domain

## Support

### Logs
- Backend: Check terminal output or logs/
- Frontend: Check browser console (F12)
- Database: Check SQLite directly

### Common Issues
1. "User already exists" → Use different email
2. "Invalid API key" → Regenerate and copy again
3. "Workspace not found" → Refresh page or check workspaceId
4. "CORS error" → Check CORS_ORIGIN matches frontend URL

### Documentation
- Full API docs: See WORKSPACE_AUTHENTICATION.md
- SDK docs: See sdk/README.md
- Database schema: See backend/src/db/schema.ts

## API Reference

### Auth Endpoints
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Current user

### Workspace Endpoints
- `GET /api/workspaces` - List workspaces
- `GET /api/workspaces/{id}` - Get workspace
- `PUT /api/workspaces/{id}` - Update workspace
- `PUT /api/workspaces/{id}/settings` - Update settings
- `POST /api/workspaces/{id}/api-keys/regenerate` - Rotate API key
- `DELETE /api/workspaces/{id}` - Delete workspace

### Data Endpoints
- `POST /api/ingest` - Record requests (requires X-API-Key)
- `GET /api/analytics/snapshot?workspaceId=...` - Get analytics
- `GET /api/telemetry?workspaceId=...` - Get telemetry
- `GET /api/telemetry/stream` - Real-time stream (SSE)

See WORKSPACE_AUTHENTICATION.md for full endpoint documentation.
