# esb-analytics-mcp

Read-only MCP (Model Context Protocol) server exposing this dashboard's sales/ops/membership/marketing analytics to AI clients — one shared tool implementation, two transports:

- **stdio** — for Claude Code / Claude Desktop, running locally on your machine.
- **Streamable HTTP** — for ChatGPT (via OpenAI's Secure MCP Tunnel), also local-only by default.

No arbitrary SQL, no generic table-query tool, no write operations. 10 fixed, bounded analytical tools. See the repo root's plan/PR description for the full design rationale; this file is setup + operational instructions only.

## 1. Apply the database migration

```bash
npx supabase login      # if you haven't already
npx supabase link --project-ref giyspsmyitlygujelqjd
npx supabase db push    # applies supabase/migrations/20260922090000_mcp_analytics_role.sql
```

This creates a dedicated `mcp_analytics` Postgres role with `SELECT` on a handful of non-PII aggregate views and `EXECUTE` on a handful of RPCs — nothing else. It has **no** `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP` privileges anywhere, enforced by the database itself, not just by this server's code. Membership data (which has a real `member_name` column) is only reachable through two new `SECURITY DEFINER` wrapper functions in a private `mcp_private` schema, and `mcp_analytics` has no direct grant on the underlying membership views at all. Full detail is in the migration file's comments.

## 2. Set the role's password (not in the migration, not in git)

In the Supabase Dashboard SQL Editor, run once:

```sql
alter role mcp_analytics with password 'choose-a-strong-password-here';
```

## 3. Get the connection string

Supabase Dashboard → **Connect** → **Session pooler** (recommended for this use case — a long-running local Node process, not a serverless/edge function, so session mode's one-real-backend-connection-per-client model fits a small connection pool well, and it avoids IPv6-only issues some networks hit with the direct connection).

The pooler requires the **role.project-ref** username format, not the bare role name:

```
postgresql://mcp_analytics.giyspsmyitlygujelqjd:<password>@<pooler-host-from-dashboard>:5432/postgres
```

(A **direct** connection — `postgresql://mcp_analytics:<password>@db.giyspsmyitlygujelqjd.supabase.co:5432/postgres`, bare role name, no project-ref suffix — also works and is the fallback if your network can't reach the pooler.)

## 4. Configure and build

```bash
cd mcp-server
npm install
cp .env.example .env   # paste the connection string from step 3 into DATABASE_URL
npm run build
```

## 5. Run it

```bash
npm run start:stdio   # for Claude Code/Desktop
npm run start:http    # for ChatGPT (binds 127.0.0.1:3001 by default, never public)
```

### Verify with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node --env-file=.env dist/transports/stdio.js
```

Confirm all 10 tools list correctly, `list_outlets`/`sales_summary` return real data, `top_members` never includes `member_name`, and a malformed/reversed date or an oversized `limit` comes back as a clean tool error (not a crash).

For HTTP, run `npm run start:http` and point MCP Inspector at `http://127.0.0.1:3001/mcp` in Streamable HTTP mode — it should list the identical 10 tools/schemas, proving both transports share one core.

## 6. Connect Claude Code

A project-scoped `.mcp.json` already exists at the repo root, committed, pointing at `mcp-server/dist/transports/stdio.js` with `--env-file=mcp-server/.env` (so the secret stays only in that gitignored file, never in `.mcp.json` itself). Restart Claude Code in this repo and it should show `esb-analytics` as a connected server.

## 7. Connect ChatGPT

ChatGPT connects over remote HTTPS only — it cannot reach a bare `localhost` MCP server directly, unlike Claude Code's stdio support.

**Option A — OpenAI Secure MCP Tunnel (recommended for local/private use):** an outbound-only connector (`openai/tunnel-client`) that exposes this local HTTP server to ChatGPT/Codex/the Responses API without opening any inbound port or making the server public. Run `npm run start:http` here, then follow OpenAI's Secure MCP Tunnel setup to point a tunnel at `http://127.0.0.1:3001/mcp`; in ChatGPT, enable Developer Mode (Settings → Apps & Connectors), add a developer-mode app, choose **Tunnel** as the connection, and select the tunnel once it's listed.

**Option B — hosted HTTPS (future, not built here):** deploy `dist/transports/http.js` somewhere reachable over HTTPS, with real authentication in front of it (the current `localhostHostValidation()`/`localhostOriginValidation()` guards only protect a loopback-bound server — a public deployment needs its own auth layer first). Not part of this task's scope.

This MCP server never calls the OpenAI API itself — it's a data/tool provider only.

## Known pre-existing issue (unrelated, not fixed by this work)

`fn_top_members` lost its `authenticated` grant when it was dropped and recreated in `supabase/migrations/20260821110000_member_menu_purchases.sql` (to add a `favorite_menu` column) — no later migration re-grants it. The dashboard's own "Top Member by Spending" panel may currently error for real logged-in users. Worth its own one-line fix migration; not touched here since it's outside this task's scope.
