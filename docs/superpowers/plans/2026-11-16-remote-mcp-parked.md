# Parked: a remote, read-only StudentsBudget MCP server (16-11-2026)

**Status:** parked by Roshan on 16-11-2026, until the legal pages and the email sender are live.

## Context

Roshan asked two things:
1. Does the MCP server work with any AI agent, or only Claude?
2. Is it practical to give students a read-only MCP connection, so they can ask their own AI ("can I afford to eat out this week?") about their own account?

## Answer

**1. Which agents.** MCP is an open protocol, so any MCP client can use a StudentsBudget server: Claude, ChatGPT, Cursor, VS Code Copilot, Gemini CLI and others. But today's server is local (stdio):
- It runs as a process on the user's machine, from a checkout of the repo, with Node and a `.env.local` that holds the password.
- Only desktop or IDE agents that launch local processes can use it. ChatGPT, and claude.ai on the web or phone, need a remote server over HTTPS.
- So in practice it works only for Roshan.

**2. Read-only access for students.** Practical, but only as a separate, remote server. The local one can't simply be handed out.
- **Sign-in:** students must never paste their password into an AI. The server needs OAuth: the student signs in on our page and approves the AI's access.
  - Supabase Auth can now act as the OAuth 2.1 server for an MCP server, with dynamic client registration. It was in public beta as of late 2025; check its status before building.
  - We'd write the MCP endpoint and the consent page ourselves.
- **Hosting:** a Supabase Edge Function at an HTTPS address, like the `ai` function. This fits CLAUDE.md's "no server routes" rule. Row-level security keeps every read to the student's own rows, since the token is theirs.
- **What it can answer:** the existing read tools carry over (`budget_overview`, `recent_entries`, `week_check_in`, the city catalogs), reused from `mcp/`. "Can I afford to eat out?" is `budget_overview`'s envelope plus `thisWeek`.
- **Limits that make it less useful than it sounds:**
  - It sees only a linked phone's data, as of its last sync. A guest's data never leaves the phone.
  - An account with two-step sign-in needs the code in the OAuth sign-in, so the consent page must handle it.
  - The student's budget then goes to OpenAI or Anthropic. That needs its own section in the privacy notice and a data-protection note. It's the student's choice, but we must say so.
  - The legal pages aren't live yet (`src/data/legal.ts` placeholders), and something like this shouldn't go public before them.
- **Overlap:** the app's own Ask already answers "can I afford to eat out?" inside the app, with sources, within the daily allowance. A remote server only adds value for students who live in ChatGPT or Claude.

**My honest view:** technically sound, and a good learning project in OAuth and remote MCP. As a product step it's premature: a few users, the legal pages not live, and Ask already covering the question. My recommendation is to park it until after the legal pages and the email sender are live. When it comes, plan it as below.

## Plan sketch, when it's wanted (about 5 chunks)

1. **Spike:** turn on Supabase's OAuth server on a branch project, and connect Claude's custom connector to a hello-world MCP Edge Function. This settles whether the beta holds up.
2. **The endpoint:** an Edge Function `mcp` on the SDK's Streamable HTTP transport. The read tools are moved from `mcp/` into `supabase/functions/_shared/mcp/` and used by both servers. No writes: `add_expense` stays local-only.
3. **Sign-in and consent:** an app page `/connect` for the OAuth consent, handling the two-step code, with the e2e mocked like `mockSupabaseAuth`.
4. **Privacy:** a privacy-notice section, a data-protection note on the consent page, and Settings → Your account listing connected AIs, with Revoke.
5. **Real try:** with Claude and with ChatGPT's developer mode, on Roshan's account.

## Sources

- [Supabase: MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase: OAuth 2.1 server changelog](https://supabase.com/changelog/38022-oauth-2-1-server-capabilities-for-supabase-auth)
- [Auth0: add a remote MCP server to ChatGPT](https://auth0.com/blog/add-remote-mcp-server-chatgpt/)
- [Zuplo: ChatGPT connectors and MCP](https://zuplo.com/learn/mcp/compatibility/clients/chatgpt-connectors)
