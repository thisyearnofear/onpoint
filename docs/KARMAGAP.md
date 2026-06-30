# KarmaGAP Integration

KarmaGAP API integration for OnPoint. Provides access to projects, grants, and Hermes AI agent management.

## API Routes

All KarmaGAP endpoints are available at `/api/karmagap/*` from the OnPoint API.

### Projects

- `GET /api/karmagap/projects` - List/search projects with filtering and pagination
  - Query params: `page`, `limit`, `search`, `tags`, `chainID`, `sortBy`, `sortOrder`
- `GET /api/karmagap/projects/:identifier` - Get project by UID or slug
- `GET /api/karmagap/projects/:identifier/milestones` - Get project milestones
- `GET /api/karmagap/projects/:identifier/grants` - Get project grants
- `GET /api/karmagap/projects/:identifier/updates` - Get project updates and activities

### Hermes AI Agent

- `GET /api/karmagap/hermes/orgs/:slug` - Get Hermes org metadata
- `POST /api/karmagap/hermes/orgs/:slug/provision` - Provision Hermes container for organization
- `GET /api/karmagap/hermes/orgs/:slug/profiles` - List Hermes profiles in org
- `GET /api/karmagap/hermes/orgs/:slug/brain/:topic` - Read structured org brain data
- `PUT /api/karmagap/hermes/orgs/:slug/brain/:topic` - Save structured org brain data
- `GET /api/karmagap/hermes/orgs/:slug/work/tasks` - List Hermes tasks
- `POST /api/karmagap/hermes/orgs/:slug/work/tasks` - Create Hermes task

### User

- `GET /api/karmagap/user/me` - Get current authenticated user

## Environment Variables

```bash
KARMA_GAP_API_KEY=your_api_key_here
KARMA_GAP_BASE_URL=https://gapapi.karmahq.xyz/v2  # optional, defaults to this
```

## Authentication

The KarmaGAP API uses API key authentication via the `x-api-key` header. The API key is configured via the `KARMA_GAP_API_KEY` environment variable.

## Rate Limiting

All KarmaGAP endpoints use the `generalRateLimit` middleware.

## API Documentation

Full API documentation: https://gapapi.karmahq.xyz/api-docs

## Example Usage

### Search for Web3 Projects

```bash
curl "http://localhost:48751/api/karmagap/projects?search=web3&tags=ethereum&limit=10"
```

### Get Project Details

```bash
curl "http://localhost:48751/api/karmagap/projects/onpoint"
```

### Provision Hermes Agent

```bash
curl -X POST "http://localhost:48751/api/karmagap/hermes/orgs/onpoint/provision"
```

### Save Organization Knowledge

```bash
curl -X PUT "http://localhost:48751/api/karmagap/hermes/orgs/onpoint/brain/strategy" \
  -H "Content-Type: application/json" \
  -d '{
    "mission": "AI-powered fashion discovery",
    "values": ["accessibility", "sustainability", "innovation"],
    "keyMetrics": ["user_engagement", "conversion_rate", "agent_accuracy"]
  }'
```

## Implementation

The integration is implemented in:
- `/apps/api/routes/karmagap.js` - API route handlers
- `/apps/api/server.js` - Route registration

The routes are publicly accessible (no service key auth) for read operations, making it easy to integrate KarmaGAP project discovery into the OnPoint frontend.
