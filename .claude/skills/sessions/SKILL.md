---
name: sessions
description: OWASP session management guidelines for cookie-based authentication middleware — covers session ID generation, cookie configuration, lifecycle, expiration, fetch metadata resource isolation, attack detection, fingerprinting, and logging.
---

# Session Management (OWASP)

When implementing or modifying session handling, follow the OWASP Session Management Cheat Sheet. This project uses cookie-based session IDs and acts as authentication middleware.

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

## Session ID Properties

- Generate session IDs using a CSPRNG (e.g. `crypto.randomUUID()`). Never use predictable or sequential values.
- Session IDs must contain at least 64 bits of entropy. When using hex encoding, that means at least 16 hex characters.
- Session ID values must be opaque and meaningless — never encode user data, roles, or timestamps into the ID itself. All session state belongs server-side.
- Use a generic cookie name (e.g. `session_id` or `id`). Avoid names that fingerprint the framework or runtime.

## Cookie Configuration

All session cookies must include these attributes:

- **`Secure`** — only transmit over HTTPS.
- **`HttpOnly`** — prevent JavaScript access via `document.cookie`.
- **`SameSite=Strict`** — block cross-site request inclusion. Use `Lax` only if cross-origin navigation requires it; never use `None` without `Secure`.
- **`Path=/`** — scope to the application root.
- **No `Domain` attribute** — restrict the cookie to the exact origin server, preventing subdomain leakage.
- **Prefer non-persistent cookies** — OWASP highly recommends session cookies (no `Expires`/`Max-Age`) so the session ID is cleared when the browser closes. If `Max-Age` is used, it must be aligned with the server-side session TTL. The current implementation sets `Max-Age` equal to the absolute timeout for convenience — this is an acceptable tradeoff but means the cookie persists on disk. Consider removing `Max-Age` for higher-security deployments.
- **Use `__Host-` prefix** when possible — this enforces `Secure`, no `Domain`, and `Path=/` at the browser level, preventing subdomain forgery.

Target `Set-Cookie` header:
```
Set-Cookie: __Host-session_id=<value>; Secure; HttpOnly; SameSite=Strict; Path=/
```

## Session Lifecycle

- **Strict mode only** — never accept a session ID that the server did not generate. If an unknown session ID arrives, ignore it and issue a new one.
- **Regenerate session ID after authentication** — after successful passkey verification (login or registration), create a new session ID and invalidate the old one. This prevents session fixation.
- **Regenerate after any privilege change** — this includes role escalation, password/email changes, or switching from anonymous to authenticated state.
- **Reauthentication for high-risk operations** — require fresh authentication before critical account changes: passkey deletion, email change, or any action that could lock the user out. OWASP recommends this for password changes, login from new IP/device, and account recovery flows.
- **Treat session IDs as untrusted user input** — validate format before processing. Do not pass raw session IDs into SQL or other interpreters without parameterized queries.

## Session Expiration

OWASP recommends both idle and absolute timeouts. This project uses **absolute timeout only** (8 hours). Idle timeout was omitted by design to avoid complexity — since this is middleware that forwards to an origin server, tracking "last activity" would require updating the session record on every request, adding a DB write per request.

- **Absolute timeout** — set a maximum session lifetime regardless of activity (e.g. 4–8 hours). After this, force re-authentication. Enforced server-side via `created_at` check in `getSession()`.
- **Renewal timeout** (not yet implemented) — periodically regenerate the session ID mid-session (e.g. every 15–30 minutes) to reduce the hijacking window. The old session ID should remain valid for a short grace period to accommodate in-flight requests. This complements the absolute timeout, especially when absolute lifetime is long.
- **Server-side invalidation is mandatory** — on timeout or logout, delete the session record from the database. Do not rely on the cookie disappearing from the client.
- **On logout**: delete the server-side session, clear the cookie (`Max-Age=0`), and return `Clear-Site-Data: "cache", "cookies", "storage"` where supported.

## Response Headers for Session-Bearing Responses

- Include `Cache-Control: no-store` on any response that sets or relies on a session cookie. This prevents session IDs from being cached in proxies or browsers.
- Consider adding `Strict-Transport-Security` (HSTS) to enforce HTTPS and prevent protocol downgrade attacks.

## Fetch Metadata — Resource Isolation Policy

References:
- https://web.dev/articles/fetch-metadata
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#fetch-metadata-headers

Modern browsers send `Sec-Fetch-*` request headers that describe the context of every request. Use these to build a Resource Isolation Policy — a server-side middleware that rejects illegitimate cross-origin requests before they reach application logic. This defends against CSRF, XSSI, timing attacks, and cross-origin information leaks without requiring CSRF tokens or client-side changes.

### The headers

- **`Sec-Fetch-Site`** — primary signal. Values: `same-origin`, `same-site`, `cross-site`, `none` (user-initiated, e.g. bookmark).
- **`Sec-Fetch-Mode`** — request mode: `navigate`, `cors`, `no-cors`, `same-origin`, `websocket`.
- **`Sec-Fetch-Dest`** — request destination: `document`, `script`, `image`, `empty` (fetch/XHR), etc.
- **`Sec-Fetch-User`** — `?1` if triggered by user activation (click, form submit).

### Implementation steps

Implement as middleware that runs before route handlers. Evaluate in this order:

1. **Allow requests without `Sec-Fetch-Site`** — older browsers that don't send fetch metadata. Fall back to `Origin`/`Referer` verification for these requests.
2. **Block embedding destinations** — reject any request where `Sec-Fetch-Dest` is `object`, `embed`, or `iframe`. This application must not be framed. Pair with an `X-Frame-Options: DENY` response header.
3. **Allow `same-origin` and `same-site` requests** — both are trusted (we trust sibling subdomains).
4. **Allow `none` with `navigate` mode and `GET` method** — these are direct navigations (typed URL, bookmark). Block `none` for non-navigational requests.
5. **Allow simple top-level GET navigations from `cross-site`** — only when `Sec-Fetch-Mode: navigate`. This lets external sites link to your pages.
6. **Reject all other `cross-site` requests** — especially state-changing methods. Return `403`.

```
// Pseudocode for resource isolation policy
function allowRequest(req): boolean {
  const site = req.headers["sec-fetch-site"]
  const mode = req.headers["sec-fetch-mode"]
  const dest = req.headers["sec-fetch-dest"]

  // Step 1: no fetch metadata — fall back to Origin/Referer check
  if (!site) return fallbackOriginCheck(req)

  // Step 2: block embedding — this app must not be framed
  if (["object", "embed", "iframe"].includes(dest)) return false

  // Step 3: same-origin and same-site are always allowed
  if (site === "same-origin" || site === "same-site") return true

  // Step 4–5: allow user-initiated top-level GET navigations
  if (site === "none" || site === "cross-site") {
    if (mode === "navigate" && req.method === "GET") return true
  }

  // Step 6: reject everything else
  return false
}
```

### Fallback for missing headers

When `Sec-Fetch-*` headers are absent, choose based on endpoint sensitivity:

- **Sensitive endpoints (API routes, state-changing)** — fail-safe: reject the request unless `Origin` or `Referer` matches the expected origin.
- **Public pages** — fail-open: allow, but log for monitoring.

### Requirements

- Application must be served over HTTPS. Fetch metadata headers are only sent to secure origins.
- Enforce HSTS to prevent protocol downgrades that strip these headers.
- Never use safe HTTP methods (`GET`, `HEAD`, `OPTIONS`) for state-changing operations.

### Rollout

- **Exempt intentional cross-origin endpoints** — if any endpoint is designed for cross-origin access (e.g. CORS-enabled APIs, public assets), explicitly allowlist its path.
- **Include `Vary: Sec-Fetch-Site, Origin`** on responses where the server's decision depends on these headers, to prevent CDN/proxy cache poisoning.
- **Document exceptions** — maintain an explicit list of paths exempted from the policy.

## Session Attack Detection & Cookie Theft Mitigation

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Cookie_Theft_Mitigation_Cheat_Sheet.html

- **Brute force protection** — detect and rate-limit repeated requests with invalid or different session IDs from the same IP.
- **Concurrent session policy** — decide whether to allow simultaneous sessions per user. If not, terminate the previous session on new login.

### Session Fingerprinting

When a session is created, capture and store these client properties alongside the session record:

- **Core** (always store): IP address, `User-Agent`, `Accept-Language`.
- **Supplementary** (store when available): `Accept`, `Accept-Encoding`, `Sec-CH-UA-*` client hints.

On each subsequent request, compare the current values against the stored fingerprint. A stolen cookie used from a different device, region, or browser will cause detectable drift in these values.

### Detection vs. False Positives

Fingerprint changes do not prove an attack — users switch Wi-Fi networks, update browsers, or travel. Avoid blocking on a single signal change. Instead:

- Use **multiple signals together** to build confidence (e.g., IP geo-region changed *and* User-Agent changed simultaneously is higher risk than either alone).
- Accept that false negatives exist — an attacker in the same region with the same browser version will evade fingerprint checks.

### Graduated Validation Response

When suspicious fingerprint drift is detected, respond proportionally:

- **Low-risk pages (read-only)** — allow access but log the anomaly for monitoring.
- **Medium-risk actions** — allow access but log and monitor the anomaly for further analysis.
- **High-risk actions (data mutation, account changes)** — require full re-authentication. Invalidate the current session, force a new login, and issue a fresh session ID.

Apply stricter checks to sensitive endpoints (e.g., account deletion, email change) and lighter checks to general browsing, to balance security with user experience.

## Session Logging

- Log session lifecycle events: creation, authentication binding, renewal, expiration, logout, and any anomalies.
- **Never log raw session IDs.** If session-specific correlation is needed in logs, log a salted hash of the session ID instead.
- Log associated metadata: timestamp, source IP, User-Agent, and the action performed.
