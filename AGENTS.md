# AGENTS.md

Project-specific context for AI agents. For behavioral guidelines, see @CLAUDE.md.

## Project

WebAuthn PRF — a passkey/WebAuthn project exploring the PRF extension, deployed on Cloudflare Workers.

## Stack

- **Runtime:** Cloudflare Workers (`wrangler` ^4.95.0)
- **Package manager:** pnpm

## Domain skills

Consult the relevant skill in `.claude/skills/` before working in these areas:

- **passkeys** — WebAuthn registration/authentication, PRF extension.
- **sessions** — session management and cookies.
- **csp** — Content Security Policy.
- **cloudflare** / **workers-best-practices** / **wrangler** — Workers platform, config, and CLI.
- **durable-objects** — stateful coordination on Workers.
