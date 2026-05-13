# TokenWatch Multi-Workspace Authentication System

## Implementation Complete ✅

This document describes the complete multi-workspace authentication and authorization system for TokenWatch.

## Architecture Overview

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
```

#### Workspaces Table
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  monthly_budget REAL DEFAULT 100,
  webhook_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

#### API Keys Table
```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
)
```

#### Workspace Settings Table
```sql
CREATE TABLE workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  alert_on_high_cost BOOLEAN DEFAULT TRUE,
  alert_on_errors BOOLEAN DEFAULT TRUE,
  alert_cost_threshold REAL DEFAULT 50,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
)
```

#### Requests Table (Extended)
```sql
ALTER TABLE requests ADD COLUMN workspace_id TEXT;
CREATE INDEX idx_requests_workspace_id ON requests(workspace_id);
FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
```

## Authentication Flow

### Sign Up
```
POST /api/auth/signup
Body: { email, password }
Response: { user, workspace, apiKey }

1. Validate email/password
2. Hash password with scrypt (16-byte salt)
3. Create user record
4. Create default workspace
5. Generate initial API key (tw_live_xxxxx format)
6. Issue JWT token in httpOnly cookie
7. Return user, workspace, and API key data
```

### Login
```
POST /api/auth/login
Body: { email, password }
Response: { user }

1. Find user by email
2. Verify password with stored hash
3. Issue JWT token in httpOnly cookie
4. Return user data
```

### Logout
```
POST /api/auth/logout
Response: { ok: true }

1. Clear httpOnly cookie
```

### Get Current User
```
GET /api/auth/me
Headers: Cookie: tokenwatch_auth=...
Response: { user, workspaces }

1. Verify JWT from cookie
2. Fetch user and all workspaces
3. Include API key info and settings for each workspace
```

## API Key Management

### Format
- **Production Keys**: `tw_live_` prefix + 24 random characters
- **Storage**: Never store plain keys, only SHA256 hash

### Generation
```typescript
// Generate 24-byte random key
const keyBytes = randomBytes(24);
const key = `tw_live_${keyBytes.toString('hex')}`;
const hash = sha256(key);
// Store hash in database
```

### Validation
```
POST /api/ingest
Headers: X-API-Key: tw_live_xxxxx

1. Hash the provided key
2. Look up hash in api_keys table
3. If found, get workspace_id and attach to request
4. Process telemetry with workspace context
5. Filter results by workspace_id
```

### Rotation
```
POST /api/workspaces/{id}/api-keys/regenerate
Headers: Cookie: tokenwatch_auth=...
Response: { apiKey }

1. Verify user owns workspace
2. Generate new API key
3. Revoke old key (delete from api_keys table)
4. Return new key
```

## Workspace Isolation

All data queries are filtered by `workspace_id`:

### Analytics Query
```
GET /api/analytics/snapshot?workspaceId={id}
Headers: Cookie: tokenwatch_auth=...

1. Verify user is authenticated
2. Verify user owns workspace
3. Query with WHERE workspace_id = ?
4. Return analytics for workspace only
```

### Telemetry Query
```
GET /api/telemetry?workspaceId={id}
Headers: Cookie: tokenwatch_auth=...

1. Verify authentication
2. Verify workspace ownership
3. Query: SELECT * FROM requests WHERE workspace_id = ? LIMIT 500
4. Return telemetry rows
```

### Real-time SSE Stream
```
EventSource: /api/telemetry/stream
Headers: Cookie: tokenwatch_auth=...

1. Verify authentication
2. Open EventSource connection
3. For each telemetry event:
   - Check event.workspace_id matches user's workspace
   - Only send matching events
```

## Workspace Settings

### Editable Settings
```
PUT /api/workspaces/{id}
{
  name: string,
  monthly_budget: number,
  webhook_url?: string
}

PUT /api/workspaces/{id}/settings
{
  alert_on_high_cost: boolean,
  alert_on_errors: boolean,
  alert_cost_threshold: number
}
```

## Frontend Architecture

### AuthContext
```typescript
interface AuthContextType {
  user: AuthUser | null;
  workspaces: WorkspaceInfo[] | null;
  currentWorkspace: WorkspaceInfo | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentWorkspace: (workspace: WorkspaceInfo) => void;
  refreshUser: () => Promise<void>;
}
```

### Protected Routes
```typescript
<Route path="/app/*" element={
  <ProtectedRoute>
    <DashboardPages />
  </ProtectedRoute>
}/>
```

### Query Integration
```typescript
// All queries support workspace filtering
const analytics = useAnalyticsSnapshotQuery(currentWorkspace?.id);
const telemetry = useTelemetryRowsQuery(currentWorkspace?.id);

// Queries have enabled guards
enabled: !!currentWorkspace?.id
```

### Settings Page
- API key display with copy-to-clipboard
- API key regeneration with confirmation
- Workspace name, budget, and webhook editing
- Alert configuration (toggle + threshold)
- Delete workspace functionality
- Toast notifications for all operations

## SDK Integration

### Initialization
```typescript
TokenWatch.init({
  apiKey: "tw_live_xxxxx",      // Required
  workspaceId: "ws_xxxxxxxx",   // Required
  apiUrl: "http://localhost:3001" // Required
});
```

### Usage
```typescript
// SDK automatically includes workspace context
TokenWatch.recordRequest({
  route: "POST /api/chat",
  model: "gpt-4",
  cost_usd: 0.05,
  // ... other fields
});
```

## Middleware Pipeline

### authenticateUser
```typescript
// 1. Check for JWT in cookie or Authorization header
// 2. Verify JWT signature
// 3. Attach userId to req.userId
// 4. Block request if invalid
```

### authenticateSDK
```typescript
// 1. Check for X-API-Key header
// 2. Hash the key and look up in database
// 3. Attach workspaceId to req.workspaceId
// 4. Block request if invalid
```

### attachWorkspaceOptional
```typescript
// 1. Check for workspaceId in query params
// 2. Optionally attach to req.workspaceId
// 3. Used when workspaceId is required but user is authenticated
```

## Security Features

### Password Security
- Scrypt hashing with 16-byte salt
- 10,000 iterations (default)
- Timing-safe comparison

### API Key Security
- 24-byte random generation
- Never stored in plain text (SHA256 hash only)
- Invalidated immediately on rotation
- Prefix `tw_live_` indicates production use

### JWT Security
- HMAC-SHA256 signing
- 30-day expiration
- httpOnly cookies to prevent XSS
- SameSite=lax to prevent CSRF
- Secure flag in production

### Workspace Isolation
- All queries filtered by workspace_id
- SSE stream validates workspace ownership per message
- Settings operations require workspace ownership check
- API key can only be used for its workspace

## Testing

Run the comprehensive test suite:
```bash
npm run test:workspace
# or
npx ts-node backend/test-workspace-system.ts
```

Tests validate:
1. User signup and default workspace creation
2. Login and session management
3. API key generation and validation
4. Telemetry ingestion with workspace context
5. Analytics queries filtered by workspace
6. Invalid API key rejection
7. Multiple workspace support
8. API key rotation and old key invalidation
9. Workspace data isolation
10. Logout and session invalidation

## Dashboard Pages

All dashboard pages integrated with workspace context:

### Overview
- Budget tracking for current workspace
- Endpoint/model analytics
- Recent requests from workspace

### Endpoints
- Routes for current workspace only
- Drill-down into specific endpoints

### Models
- Model statistics for current workspace
- Cost and usage by model

### Requests
- Real-time telemetry for current workspace
- Filterable by endpoint/model

### Settings
- API key management
- Workspace name/budget
- Alert configuration
- Delete workspace

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create user and workspace
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### Workspaces
- `GET /api/workspaces` - List user's workspaces
- `GET /api/workspaces/{id}` - Get workspace details
- `PUT /api/workspaces/{id}` - Update workspace
- `PUT /api/workspaces/{id}/settings` - Update settings
- `POST /api/workspaces/{id}/api-keys/regenerate` - Rotate API key
- `DELETE /api/workspaces/{id}` - Delete workspace
- `POST /api/workspaces` - Create new workspace

### Analytics (Require authentication)
- `GET /api/analytics/snapshot?workspaceId={id}` - Get analytics
- `GET /api/telemetry?workspaceId={id}` - List telemetry
- `GET /api/telemetry/stream` - Real-time SSE stream

### Ingestion (Require API key)
- `POST /api/ingest` - Ingest telemetry with X-API-Key header

## Environment Variables

```env
# Backend
JWT_SECRET=dev-secret-key-please-set-in-production
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development

# Frontend
VITE_TOKENWATCH_API_URL=http://localhost:3001
```

## Deployment Checklist

- [ ] Set `JWT_SECRET` to strong random value
- [ ] Set `NODE_ENV` to `production`
- [ ] Enable `secure: true` for cookies in production
- [ ] Configure `CORS_ORIGIN` for your domain
- [ ] Use HTTPS in production
- [ ] Run database migrations
- [ ] Verify all auth routes working
- [ ] Test API key validation
- [ ] Validate workspace isolation in production

## Key Files

### Backend
- `src/db/schema.ts` - Database schema definitions
- `src/db/database.ts` - Database initialization
- `src/utils/auth.ts` - Cryptographic functions
- `src/services/authService.ts` - Authentication business logic
- `src/middleware/auth.ts` - Authentication middleware
- `src/routes/auth.ts` - Auth endpoints
- `src/routes/workspaces.ts` - Workspace management endpoints
- `src/routes/ingest.ts` - Telemetry ingestion endpoint

### Frontend
- `src/contexts/AuthContext.tsx` - Auth state management
- `src/components/ProtectedRoute.tsx` - Route protection
- `src/pages/Login.tsx` - Login page
- `src/pages/Signup.tsx` - Signup page
- `src/pages/app/Settings.tsx` - Workspace settings
- `src/pages/app/Overview.tsx` - Dashboard overview
- `src/pages/app/Endpoints.tsx` - Endpoints page
- `src/pages/app/Models.tsx` - Models page
- `src/pages/app/Requests.tsx` - Requests page

## Performance Considerations

### Database Indexes
- `users(email)` - Fast email lookup
- `workspaces(user_id)` - Fast workspace enumeration
- `api_keys(key_hash)` - Fast API key validation
- `requests(workspace_id)` - Fast workspace filtering

### Query Optimization
- All analytics queries use workspace_id filter
- SSE stream validates workspace per message
- Queries use connection pooling

### Caching
- React Query caching with 5-second stale time
- EventSource for real-time updates
- Automatic refetch on window focus

## Known Limitations

1. Single workspace per initial signup (can create more)
2. API keys stored as hashes (cannot retrieve plain key after creation)
3. No password reset flow yet
4. No team/user management (per workspace)
5. No audit logging for workspace changes

## Future Enhancements

1. User password reset with email verification
2. Per-workspace user invitations
3. Role-based access control (Admin/Viewer/Editor)
4. Audit logging for all workspace changes
5. IP-based API key restrictions
6. Rate limiting per API key
7. Webhook signing and verification
8. Workspace resource quotas
