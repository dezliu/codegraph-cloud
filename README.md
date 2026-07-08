# CodeGraph Cloud

Cloud-hosted code knowledge graph platform with MCP API. Automatically sync Git repositories, build code intelligence indexes, and expose code query capabilities via MCP (Model Context Protocol) for AI assistants like Cursor and Claude.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin Panel │     │  REST API    │     │  MCP Server  │
│  (Next.js)   │     │  (Hono)      │     │  (Streamable │
│  :3003       │     │  :3000       │     │   HTTP) :3002│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                     │
       └────────────────────┼─────────────────────┘
                            │
                     ┌──────┴───────┐
                     │  PostgreSQL  │
                     │  + pg-boss   │
                     │  :5432       │
                     └──────┬───────┘
                            │
                     ┌──────┴───────┐
                     │   Worker     │
                     │  Sync+Index  │
                     │  + Query API │
                     │  :3001       │
                     └──────────────┘
```

## Monorepo Structure

```
codegraph-cloud/
├── apps/
│   ├── api/            # REST API + Webhook receiver + Job scheduler
│   ├── mcp-server/     # MCP Streamable HTTP server
│   ├── worker/         # Sync + Index workers with query endpoint
│   └── admin/          # Next.js admin panel
├── packages/
│   ├── core/           # Forked codegraph engine (extraction/resolution/graph)
│   ├── shared/         # Shared types, constants, encryption utils
│   └── db-schema/      # Drizzle ORM PostgreSQL schema
├── docker-compose.yml
└── docs/plans/         # Architecture spec
```

## Features

- **Git Sync**: Automatic code sync via webhooks (GitLab) or polling
- **Code Indexing**: Tree-sitter based multi-language code parsing (20+ languages)
- **Knowledge Graph**: Symbol relationships, call graphs, dependency resolution
- **MCP API**: Query code intelligence from Cursor, Claude, or any MCP client
- **Admin Panel**: Manage projects, API keys, and monitor sync status
- **Incremental Updates**: Only re-index changed files on each sync

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API Framework | Hono |
| Admin UI | Next.js 15 + Tailwind CSS |
| Database | PostgreSQL 16 |
| Job Queue | pg-boss (PostgreSQL-based) |
| ORM | Drizzle ORM |
| Code Parsing | Tree-sitter (WASM) |
| MCP Transport | Streamable HTTP |
| Package Manager | pnpm workspaces |

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL)

### Setup

```bash
# Clone the repository
git clone https://github.com/dezliu/codegraph-cloud.git
cd codegraph-cloud

# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up -d

# Copy environment file
cp .env.example .env

# Run database migrations
pnpm db:migrate

# Start all services in development mode
pnpm dev
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| API | 3000 | REST API + Webhooks |
| Worker | 3001 | Background jobs + Query endpoint |
| MCP Server | 3002 | MCP protocol endpoint |
| Admin | 3003 | Admin panel UI |

## Usage

### 1. Create a Project

Via Admin Panel (`http://localhost:3003`):
- Navigate to Projects → New Project
- Enter repository URL and Git provider
- Save to create the project

Via API:
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer <admin-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "default",
    "name": "My Project",
    "repoUrl": "https://gitlab.com/org/repo.git",
    "gitProvider": "gitlab"
  }'
```

### 2. Trigger Sync

```bash
curl -X POST http://localhost:3000/api/projects/<project-id>/sync \
  -H "Authorization: Bearer <admin-api-key>"
```

### 3. Create API Key for MCP Access

Via Admin Panel → Settings → Create API Key

### 4. Configure MCP Client

Add to your Cursor or Claude MCP settings:

```json
{
  "mcpServers": {
    "codegraph-cloud": {
      "url": "http://localhost:3002/mcp",
      "headers": {
        "Authorization": "Bearer cgk_your_api_key",
        "X-Project-Id": "proj_your_project_id"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `codegraph_explore` | Explore code graph around a symbol |
| `codegraph_search` | Full-text search for symbols |
| `codegraph_callers` | Find callers of a function |
| `codegraph_callees` | Find functions called by a function |
| `codegraph_impact` | Analyze impact radius of changes |
| `codegraph_status` | Get index status for a project |

## Webhook Configuration

### GitLab

1. Go to your GitLab project → Settings → Webhooks
2. Set URL: `https://your-domain.com/webhooks/gitlab`
3. Set a secret token (configure in project settings)
4. Enable "Push events"
5. Save

### Polling

Alternatively, enable polling in project settings to periodically check for changes.

## Environment Variables

See `.env.example` for all available configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `API_PORT` | `3000` | API server port |
| `WORKER_PORT` | `3001` | Worker query server port |
| `MCP_PORT` | `3002` | MCP server port |
| `ENCRYPTION_KEY` | (dev default) | Key for encrypting Git credentials |
| `GIT_WORKSPACE_DIR` | `./data/git-workspace` | Checked-out code directory |
| `GIT_MIRROR_DIR` | `./data/git-mirrors` | Bare Git mirror directory |

## Development

```bash
# Build all packages
pnpm build

# Run type checking
pnpm lint

# Generate Drizzle schema types
pnpm db:generate

# Run database migrations
pnpm db:migrate
```

## License

MIT
