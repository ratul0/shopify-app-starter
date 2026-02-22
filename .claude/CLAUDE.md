# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shopify embedded app built with React Router v7, Prisma, and Polaris web components. Uses Bun as the package manager.

## Commands

| Task | Command |
| --- | --- |
| Dev server (via Shopify CLI) | `bun run dev` |
| Production build | `bun run build` |
| Start production server | `bun run start` |
| Lint check | `bun run lint` |
| Auto-fix lint/format | `bun run fix` |
| Type check | `bun run typecheck` |
| Prisma setup (generate + migrate) | `bun run setup` |
| New migration | `bunx prisma migrate dev --name describe-change` |
| Deploy app config to Shopify | `bun run deploy` |
| Generate app extension | `bun run generate extension` |

Lefthook runs `bun x ultracite fix` on pre-commit automatically. Code quality is enforced by Biome via the Ultracite preset.

## Architecture

### Routing (React Router v7 file-based)

Routes live in `app/routes/`. File naming determines URL structure:

- **`app.tsx`** — Authenticated shell (AppProvider + `<s-app-nav>`). All `app.*` routes render inside its `<Outlet>`.
- **`app._index.tsx`** → `/app` (home page, inside auth shell)
- **`app.additional.tsx`** → `/app/additional` (inside auth shell)
- **`_index/route.tsx`** → `/` (public landing page, unauthenticated)
- **`auth.login/route.tsx`** → `/auth/login`
- **`auth.$.tsx`** → `/auth/*` (OAuth callback catch-all)
- **`webhooks.*.tsx`** → POST-only action routes for Shopify webhooks

**To add a new authenticated page**: create `app/routes/app.my-page.tsx` (the `app.` prefix nests it inside the auth shell) and add a nav link in `app.tsx`.

### Authentication & API Access

`app/shopify.server.ts` is the central auth config. It exports:

- `authenticate.admin(request)` — Call in every loader/action that needs the Shopify Admin API. Returns `{ admin }` with a GraphQL client.
- `authenticate.webhook(request)` — Validates webhook requests. Returns `{ payload, topic, shop, session }`.
- `login(request)` — Initiates OAuth flow.

Pattern for authenticated routes:
```ts
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(`{ shop { name } }`);
  const { data } = await response.json();
  return data;
};
```

### Server-Only Files

Files ending in `.server.ts` are excluded from the client bundle by React Router:
- `app/shopify.server.ts` — Shopify auth config, API clients, session storage
- `app/db.server.ts` — Prisma client singleton (prevents multiple instances during hot reload)

### Database

Prisma with SQLite (swappable to PostgreSQL/MySQL by changing the provider in `prisma/schema.prisma`). Currently has a single `Session` model used for OAuth session storage. Add app-specific models to the same schema.

### UI: Polaris Web Components

This app uses **Polaris web components** (lowercase `<s-*>` tags), NOT React Polaris components. Examples:
```tsx
<s-page heading="Title">
  <s-button onClick={handler}>Click me</s-button>
  <s-text-field label="Name" name="name" />
  <s-section heading="Section">
    <s-paragraph>Content</s-paragraph>
  </s-section>
</s-page>
```

Types come from `@shopify/polaris-types` (included in tsconfig). Navigation uses `<s-link>` inside `<s-app-nav>`.

### Webhooks

Registered in `shopify.app.toml` under `[[webhooks.subscriptions]]`. Each gets a corresponding route file (e.g., `webhooks.app.uninstalled.tsx`). Run `bun run deploy` to sync webhook config with Shopify.

### GraphQL Codegen

Configured in `.graphqlrc.ts` for Admin API. Scans `app/**/*.{js,ts,jsx,tsx}` for inline GraphQL and outputs types to `app/types/`.

### App Extensions

The `extensions/` directory is a Bun workspace. Scaffold new extensions (theme blocks, checkout UI, functions) with `bun run generate extension`.

## Shopify App Config

- **API version**: `2026-04` (in `shopify.app.toml`), GraphQL codegen uses `October25`
- **Scopes**: `write_products` (modify in `shopify.app.toml`)
- **Auth redirect**: `/api/auth`
- **Distribution**: AppStore

## Post-Task Validation (MANDATORY)

After completing any task (feature, bugfix, refactor, etc.), always run both checks before considering the work done:

```sh
bun run fix        # auto-fix lint/format issues
bun run typecheck  # ensure no type errors
```

The project must remain free of lint and type errors at all times. Do not leave broken state for the next task.

## Code Standards

This project uses **Ultracite** (Biome-based). See `AGENTS.md` for the full coding standards reference.

Key rules:
- Arrow functions, `for...of`, `async/await`, destructuring, `const` by default
- No `console.log`/`debugger` in production code
- Function components with hooks at top level
- `unknown` over `any`, const assertions for immutable values
