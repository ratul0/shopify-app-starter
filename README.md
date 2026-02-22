# Shopify App Starter

A batteries-included starter for building [Shopify embedded apps](https://shopify.dev/docs/apps/getting-started) with React Router v7, Prisma, and Polaris web components.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [React Router v7](https://reactrouter.com/) (file-based routing) |
| UI | [Polaris web components](https://shopify.dev/docs/api/app-home/polaris-web-components) via App Bridge |
| Database | [Prisma](https://www.prisma.io/) + SQLite (swappable) |
| Auth | [@shopify/shopify-app-react-router](https://shopify.dev/docs/api/shopify-app-react-router) (OAuth handled automatically) |
| Linting | [Biome](https://biomejs.dev/) via [Ultracite](https://github.com/haydenbleasel/ultracite) |
| Package Manager | [Bun](https://bun.sh/) |
| Git Hooks | [Lefthook](https://github.com/evilmartians/lefthook) (auto-formats on commit) |

## Prerequisites

- [Bun](https://bun.sh/) v1+
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) v3+
- A [Shopify Partner account](https://partners.shopify.com/signup) and a dev store

## Getting Started

```sh
# 1. Clone and install
git clone <this-repo> my-app
cd my-app
bun install

# 2. Connect to your Shopify app
shopify app config link

# 3. Start developing
shopify app dev
```

Press **P** in the terminal to open your app in the browser. Install the app on your dev store when prompted.

## Project Structure

```
app/
  shopify.server.ts     # Shopify app config (auth, API version, session storage)
  db.server.ts          # Prisma client singleton
  root.tsx              # Root layout
  routes.ts             # Route config (file-based via @react-router/fs-routes)
  entry.server.tsx      # SSR entry point
  routes/
    app.tsx             # Authenticated app shell (wraps all /app/* routes)
    app._index.tsx      # Main app page (product creation demo)
    app.additional.tsx   # Example additional page
    _index/route.tsx    # Public landing / login page
    auth.$.tsx          # OAuth callback handler
    auth.login/         # Login route
    webhooks.*.tsx      # Webhook handlers
prisma/
  schema.prisma         # Database schema (Session model)
  migrations/           # Prisma migrations
extensions/             # Shopify app extensions (themes, functions, etc.)
```

## Common Tasks

### Add a new authenticated page

1. Create `app/routes/app.my-page.tsx` (the `app.` prefix puts it inside the authenticated shell)
2. Add a nav link in `app/routes/app.tsx`:
   ```tsx
   <s-app-nav>
     <s-link href="/app">Home</s-link>
     <s-link href="/app/my-page">My Page</s-link>
   </s-app-nav>
   ```

### Query the Admin GraphQL API

Use `authenticate.admin(request)` in any loader or action:

```ts
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    {
      products(first: 25) {
        nodes {
          id
          title
        }
      }
    }
  `);

  const { data } = await response.json();
  return data.products.nodes;
};
```

### Add a database model

1. Edit `prisma/schema.prisma` to add your model
2. Run `bunx prisma migrate dev --name describe-your-change`
3. The Prisma client regenerates automatically

### Add a webhook handler

1. Register the topic in `shopify.app.toml`:
   ```toml
   [[webhooks.subscriptions]]
   topics = ["products/update"]
   uri = "/webhooks/products/update"
   ```
2. Create `app/routes/webhooks.products.update.tsx`:
   ```ts
   import type { ActionFunctionArgs } from "react-router";
   import { authenticate } from "../shopify.server";

   export const action = async ({ request }: ActionFunctionArgs) => {
     const { payload, topic, shop } = await authenticate.webhook(request);
     console.log(`Received ${topic} from ${shop}`);
     // Handle the webhook payload
     return new Response();
   };
   ```
3. Deploy to sync: `bun run deploy`

### Generate an app extension

```sh
bun run generate extension
```

This scaffolds a new extension in the `extensions/` directory (theme blocks, checkout UI, Shopify functions, etc.).

## Available Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start dev server via Shopify CLI |
| `bun run build` | Production build |
| `bun run lint` | Check for lint errors |
| `bun run fix` | Auto-fix lint and formatting |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run deploy` | Deploy app config to Shopify |
| `bun run setup` | Generate Prisma client + run migrations |

## Environment Variables

Shopify CLI manages most env vars automatically during `shopify app dev`. For manual setup or deployment, you need:

| Variable | Description | Example |
| --- | --- | --- |
| `SHOPIFY_API_KEY` | App API key | (from Partner Dashboard) |
| `SHOPIFY_API_SECRET` | App API secret | (from Partner Dashboard) |
| `SHOPIFY_APP_URL` | Public app URL | `https://my-app.fly.dev` |
| `DATABASE_URL` | Prisma database connection | `file:dev.sqlite` |
| `NODE_ENV` | Environment | `production` |

For local development, create a `.env` file in the project root:

```
DATABASE_URL="file:dev.sqlite"
```

## Database

This starter uses SQLite by default. To switch to PostgreSQL or MySQL:

1. Update the `provider` in `prisma/schema.prisma`
2. Update `DATABASE_URL` in your `.env`
3. Run `bunx prisma migrate dev`

See Prisma's [datasource docs](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#datasource) for connection string formats.

## Deployment

A `Dockerfile` is included for container-based deployment (uses `oven/bun:1-alpine`):

```sh
docker build -t my-shopify-app .
docker run -p 3000:3000 \
  -e SHOPIFY_API_KEY=xxx \
  -e SHOPIFY_API_SECRET=xxx \
  -e SHOPIFY_APP_URL=https://my-app.example.com \
  -e DATABASE_URL=file:prod.sqlite \
  -e NODE_ENV=production \
  my-shopify-app
```

For production hosting, see:
- [Google Cloud Run](https://shopify.dev/docs/apps/launch/deployment/deploy-to-google-cloud-run)
- [Fly.io](https://fly.io/docs/js/shopify/)
- [Render](https://render.com/docs/deploy-shopify-app)
- [Manual deployment guide](https://shopify.dev/docs/apps/launch/deployment/deploy-to-hosting-service)

## AI-Assisted Development

This project includes config for AI coding tools:

- **`.mcp.json`** configures the [Shopify Dev MCP](https://shopify.dev/docs/apps/build/devmcp) for Cursor, GitHub Copilot, Claude Code, and Gemini CLI
- **`AGENTS.md`** provides codebase context for AI agents

## Troubleshooting

**`Environment variable not found: DATABASE_URL`**
Create a `.env` file in the project root with `DATABASE_URL="file:dev.sqlite"`.

**`The table main.Session does not exist`**
Run `bun run setup` to generate the Prisma client and run migrations.

**Navigating breaks the embedded app**
Use `Link` from `react-router` or Polaris components, not `<a>` tags. Use `redirect` from `authenticate.admin`, not from `react-router`.

**Webhooks not updating during development**
App-specific webhooks (defined in `shopify.app.toml`) sync on `bun run deploy`. For shop-specific webhooks, you may need to reinstall the app on your dev store.

**Streaming responses don't work in dev**
Cloudflare tunnels buffer streams. Use [localhost-based development](https://shopify.dev/docs/apps/build/cli-for-apps/networking-options#localhost-based-development) to test streaming.

**`"nbf" claim timestamp check failed`**
Your system clock is out of sync. Enable automatic date/time in your OS settings.

## Resources

- [Shopify App React Router docs](https://shopify.dev/docs/api/shopify-app-react-router)
- [Polaris web components](https://shopify.dev/docs/api/app-home/polaris-web-components)
- [Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [App Bridge](https://shopify.dev/docs/api/app-bridge-library)
- [React Router docs](https://reactrouter.com/)
- [Prisma docs](https://www.prisma.io/docs)
