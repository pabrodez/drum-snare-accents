---
name: csp
description: OWASP Content Security Policy guidelines — strict nonce-based CSP, directive configuration, companion security headers, and violation reporting for HTML responses.
---

# Content Security Policy (OWASP)

References:
- https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- https://web.dev/articles/strict-csp

Deliver CSP via the `Content-Security-Policy` HTTP response header on every HTML response. CSP is a defense-in-depth layer against XSS, clickjacking, and data injection — it does not replace input validation or output encoding.

## Approach: Strict CSP

Prefer a **strict CSP** over allowlist-based policies. Strict policies use nonces or hashes to authorize scripts and are harder to bypass.

Since this project serves HTML from a template string (`getIndexHtml()` in `html.ts`), the server can inject a fresh nonce into both the CSP header and each `<script>` tag on every response.

## Relevant directives

Only include directives that apply. This project has no images, fonts, media, objects, or workers.

- **`default-src 'none'`** — deny everything by default. Explicitly allow only what's needed.
- **`script-src 'nonce-{RANDOM}' 'strict-dynamic'`** — allow inline scripts and the external SimpleWebAuthn bundle only via a per-request nonce. `strict-dynamic` propagates trust to scripts loaded by nonced scripts, providing a fallback for browsers that don't support nonces well.
- **`style-src 'self'`** — if styles are moved to an external file. If inline `<style>` blocks remain, use `'nonce-{RANDOM}'` (same nonce mechanism as scripts) or `'sha256-{HASH}'` of the style block. Avoid `'unsafe-inline'`.
- **`connect-src 'self'`** — allow fetch/XHR only to same-origin API endpoints (`/api/*`).
- **`form-action 'self'`** — restrict form submissions to same-origin (defense against injected phishing forms), even though this app uses JS fetch instead of HTML forms.
- **`frame-ancestors 'none'`** — prevent this page from being embedded in any frame/iframe/object. This replaces and supersedes `X-Frame-Options: DENY`.
- **`base-uri 'none'`** — prevent `<base>` tag injection that could redirect relative URLs.
- **`object-src 'none'`** — block plugins (Flash, Java, etc.).
- **`upgrade-insecure-requests`** — automatically upgrade any HTTP sub-resource requests to HTTPS.

## Target CSP header

```
Content-Security-Policy:
  default-src 'none';
  script-src 'nonce-{RANDOM}' 'strict-dynamic';
  style-src 'nonce-{RANDOM}';
  connect-src 'self';
  form-action 'self';
  frame-ancestors 'none';
  base-uri 'none';
  object-src 'none';
  upgrade-insecure-requests;
  report-to csp-endpoint
```

## Implementation guidance

1. **Generate a nonce per request** — use a CSPRNG (e.g. `crypto.randomUUID()`). The nonce must be unique per response and never reused.
2. **Inject the nonce into HTML** — add `nonce="{RANDOM}"` to every `<script>` and `<style>` tag in the template. This includes both the inline script block and the external `<script src="...">` tag.
3. **Set the header** — include the same nonce value in the `Content-Security-Policy` header.
4. **Add `integrity` to external scripts** — the `<script src="https://unpkg.com/...">` tag should include a `integrity="sha256-..."` attribute (Subresource Integrity). This prevents a compromised CDN from serving malicious code. Regenerate the hash when upgrading the library.
5. **No `'unsafe-inline'`** — never use `'unsafe-inline'` for scripts. It defeats the purpose of CSP. For styles, prefer nonces or hashes; only fall back to `'unsafe-inline'` as a last resort with a documented justification.
6. **No `'unsafe-eval'`** — never allow `eval()` or equivalent dynamic code execution.
7. **No inline event handlers or `javascript:` URIs** — these are blocked by strict CSP. Always use `addEventListener()` instead. The current codebase already follows this pattern — keep it that way.
8. **Refactor inline `style` attributes** — CSP's `style-src` nonce only covers `<style>` blocks, not inline `style="..."` attributes. Move any inline style attributes (e.g. `style="display:none"` on `#authenticated`) into the `<style>` block as CSS classes. This avoids needing `'unsafe-hashes'`.

## Companion response headers

Set these alongside CSP on HTML responses:

- **`X-Content-Type-Options: nosniff`** — prevent MIME-type sniffing.
- **`X-Frame-Options: DENY`** — legacy framing protection for older browsers that don't support `frame-ancestors`.
- **`Referrer-Policy: strict-origin-when-cross-origin`** — limit referrer leakage.

## Violation reporting

Use the Reporting API to collect CSP violations server-side:

1. Add a `Reporting-Endpoints` response header that defines the endpoint:
   ```
   Reporting-Endpoints: csp-endpoint="/api/csp-reports"
   ```
2. Reference the endpoint name in the CSP via `report-to csp-endpoint`.
3. For backward compatibility, also include `report-uri /api/csp-reports` in the CSP. Browsers that support `report-to` will ignore `report-uri`.
4. The reporting endpoint should accept `POST` with `Content-Type: application/reports+json`, log the violation, and return `204`.

## If the external script dependency changes

If the `unpkg.com` SimpleWebAuthn bundle is self-hosted or bundled in the future, remove any external domain from the policy. The `'strict-dynamic'` + nonce approach handles this automatically — any script loaded by a nonced script is trusted regardless of origin.
