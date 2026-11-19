# Security Hardening & Production Security Controls

This document details the security controls implemented in **Milestone 12**, the API security matrix, configuration guidelines, and recommendations for production deployment.

---

## 1. Security Controls Matrix

| Endpoint Group | Method & Path | Authentication | Required Roles | Input Validation | Rate Limit | Audit Logging | Sensitive Data Exposure Risk & Control |
|---|---|---|---|---|---|---|---|
| **Health** | `GET /api/health` | None | Public | None | General API Limiter | None | Exposes only status and timestamp; no DB credentials or internal paths. |
| **Auth** | `POST /api/auth/register` | None | Public | `registerSchema` (strict) | Auth Limiter (10/15m) | None | Password hashed with Argon2id; returns `SafeUser` without `passwordHash`. |
| **Auth** | `POST /api/auth/login` | None | Public | `loginSchema` (strict) | Auth Limiter (10/15m) | None | Generic 401 prevents account enumeration; returns JWT. |
| **Auth** | `GET /api/auth/me` | Bearer JWT | All authenticated | None | General API Limiter | None | Returns `SafeUser` from database verification. |
| **Cases** | `POST /api/cases` | Bearer JWT | ADMIN, INVESTIGATOR | `createCaseSchema` | General API Limiter | Implicit | `caseNumber` generated server-side; strict validation. |
| **Cases** | `GET /api/cases` | Bearer JWT | All authenticated | `listCasesQuerySchema` | General API Limiter | None | `search` bounded to 100 characters; pagination bounded. |
| **Cases** | `GET /api/cases/:id` | Bearer JWT | All authenticated | `uuidParamSchema` | General API Limiter | None | Full relations loaded; sensitive user fields filtered. |
| **Cases** | `PATCH /api/cases/:id` | Bearer JWT | ADMIN, INVESTIGATOR | `updateCaseSchema` | General API Limiter | Implicit | Immutable fields (`caseNumber`, `createdAt`) blocked. |
| **Cases** | `PATCH /api/cases/:id/status` | Bearer JWT | ADMIN, INVESTIGATOR | `updateCaseStatusSchema` | General API Limiter | `CaseStatusHistory` | Requires closure reason on `CLOSED`. |
| **Cases** | `POST /api/cases/:id/members` | Bearer JWT | ADMIN or Lead Inv | `addCaseMemberSchema` | General API Limiter | Case roster | **BOLA Defense**: Only ADMIN or case Lead Investigator permitted. |
| **Cases** | `DELETE /api/cases/:id/members/:userId` | Bearer JWT | ADMIN or Lead Inv | `uuidParamSchema` | General API Limiter | Case roster | **BOLA Defense**: Only ADMIN or case Lead Investigator permitted; lead cannot be removed without reassignment. |
| **Incidents** | `POST /api/incidents` | Bearer JWT | ADMIN, INVESTIGATOR | `createIncidentSchema` | General API Limiter | Implicit | Validates parent case existence. |
| **Incidents** | `GET /api/incidents` | Bearer JWT | All authenticated | `listIncidentsQuerySchema` | General API Limiter | None | `search` bounded to 100 characters; pagination bounded. |
| **Incidents** | `GET /api/incidents/:id` | Bearer JWT | All authenticated | `uuidParamSchema` | General API Limiter | None | Full relations loaded; safe user projection. |
| **Incidents** | `PATCH /api/incidents/:id` | Bearer JWT | ADMIN, INVESTIGATOR | `updateIncidentSchema` | General API Limiter | Implicit | Immutable fields blocked. |
| **Incidents** | `PATCH /api/incidents/:id/status` | Bearer JWT | ADMIN, INVESTIGATOR | `updateIncidentStatusSchema` | General API Limiter | `IncidentStatusHistory` | Validates status progression. |
| **Evidence** | `POST /api/evidence` | Bearer JWT | ADMIN, INVESTIGATOR | Multer + `createEvidenceSchema` | General API Limiter | `UPLOADED` Custody & Audit | Physical file stored as `<uuid>.bin`; `storagePath` hidden; streaming SHA-256. |
| **Evidence** | `GET /api/evidence` | Bearer JWT | All authenticated | `listEvidenceQuerySchema` | General API Limiter | None | Excludes `storagePath` and `storedFilename`; bounded search. |
| **Evidence** | `GET /api/evidence/:id` | Bearer JWT | All authenticated | `uuidParamSchema` | General API Limiter | `VIEWED` Audit Log | Excludes `storagePath` and `storedFilename`. |
| **Evidence** | `GET /api/evidence/:id/download` | Bearer JWT | ADMIN, INVESTIGATOR, ANALYST | `uuidParamSchema` | General API Limiter | `DOWNLOADED` Audit Log | **VIEVER denied (403)**; Content-Disposition sanitized; path containment verified. |
| **Evidence** | `GET /api/evidence/:id/integrity` | Bearer JWT | All authenticated | `uuidParamSchema` | General API Limiter | `INTEGRITY_CHECKED` Audit Log | Re-computes disk SHA-256 and compares to immutable record. |
| **Custody** | `POST /api/evidence/:id/custody/transfer` | Bearer JWT | ADMIN, INVESTIGATOR | `transferCustodySchema` | General API Limiter | `TRANSFERRED` Event & Audit | Computes cryptographic chain hash (`eventHash`). |
| **Custody** | `POST /api/evidence/:id/custody/receive` | Bearer JWT | Designated Recipient | `receiveCustodySchema` | General API Limiter | `RECEIVED` Event & Audit | **BOLA Defense**: Authenticated user must equal `toUserId`. |
| **Custody** | `POST /api/evidence/:id/custody/release` | Bearer JWT | ADMIN only | `releaseCustodySchema` | General API Limiter | `RELEASED` Event & Audit | Restricted to platform administrators. |
| **AI** | `POST /api/evidence/:id/ai/analyze` | Bearer JWT | ADMIN, INVESTIGATOR, ANALYST | `aiAnalysisRequestSchema` | AI Limiter (20/15m) | `AI_ANALYSIS_REQUESTED` Audit Log | Provider/model/keys rejected from client; text enclosed in `<UNTRUSTED_EVIDENCE_DATA>`. |
| **AI** | `POST /api/incidents/:id/ai/classify` | Bearer JWT | ADMIN, INVESTIGATOR, ANALYST | None | AI Limiter (20/15m) | Advisory classification | Strictly advisory; does not mutate incident status. |
| **Reports** | `POST /api/reports` | Bearer JWT | ADMIN, INVESTIGATOR, ANALYST | `generateReportSchema` | Report Limiter (30/15m) | None (Stateless) | No database model; deterministic report SHA-256; advisory disclaimer attached. |
| **Reports** | `POST /api/reports/preview` | Bearer JWT | ADMIN, INVESTIGATOR, ANALYST | `generateReportSchema` | Report Limiter (30/15m) | None (Stateless) | Fast preview without storage. |
| **Reports** | `POST /api/reports/export` | Bearer JWT | ADMIN, INVESTIGATOR, ANALYST | `generateReportSchema` | Report Limiter (30/15m) | None (Stateless) | Streams binary PDF (`application/pdf`); safe Content-Disposition. |
| **Dashboard**| `GET /api/dashboard/overview` | Bearer JWT | All authenticated | None | General API Limiter | None | Aggregated metrics without sensitive internals. |
| **Dashboard**| `GET /api/dashboard/search` | Bearer JWT | All authenticated | `searchQuerySchema` | Search Limiter (60/1m) | None | `q` bounded to 100 characters; `limit` bounded to 50. |

---

## 2. HTTP Security Headers Policy

Implemented in `server/src/middleware/security-headers.middleware.ts`:

- **`X-Content-Type-Options: nosniff`**: Prevents MIME-type sniffing attacks.
- **`X-Frame-Options: DENY`**: Protects against clickjacking.
- **`Referrer-Policy: strict-origin-when-cross-origin`**: Prevents leakage of internal URL paths.
- **`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`**: Disables browser APIs not needed by the platform.
- **`Cross-Origin-Opener-Policy: same-origin`**: Isolates browsing context.
- **`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`**: Enforces HTTPS in production.
- **`Content-Security-Policy`**:
  - **Production**: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  - **Development**: Environment-aware policy permitting Vite HMR websockets (`ws:`, `wss:`) and local loopback origins (`http://localhost:*`, `http://127.0.0.1:*`).
- **`X-Powered-By`**: Explicitly removed.

---

## 3. CORS Policy

Implemented in `server/src/middleware/cors.middleware.ts`:

- Reads `CORS_ORIGIN` environment variable (defaults to `http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173`).
- Rejects unauthorized origins with 403 Forbidden without reflecting arbitrary `Origin` headers.
- Never pairs wildcard `*` with `Access-Control-Allow-Credentials: true`.
- Caches preflight `OPTIONS` responses for 24 hours (`Access-Control-Max-Age: 86400`).

---

## 4. Rate Limiting Architecture

Implemented in `server/src/middleware/rate-limiter.middleware.ts`:

- **Sliding-Window Algorithm**: Evaluates request timestamps continuously to prevent burst spikes at boundary markers.
- **Targeted Limiters**:
  - `authRateLimiter`: 10 attempts per 15 minutes.
  - `aiRateLimiter`: 20 analyses per 15 minutes.
  - `reportRateLimiter`: 30 reports per 15 minutes.
  - `searchRateLimiter`: 60 searches per minute.
  - `generalApiRateLimiter`: 500 requests per 15 minutes.
- **Client Identity**: Safely resolved via `getClientIp()` — direct socket address is used unless `trust proxy` is explicitly configured.
- **Automated Test Compatibility**: Detects `NODE_ENV === 'test'` server-side to prevent interference with regression suites, with zero client-controlled bypass headers.

---

## 5. Production Deployment Recommendations

### Implemented in Milestone 12:
- [x] Environment-aware Content Security Policy (CSP).
- [x] Strict CORS origin validation.
- [x] Sliding-window rate limiters on sensitive routes.
- [x] Strong JWT secret enforcement (>= 32 characters in production).
- [x] BOLA/IDOR protection on case rosters and custody transfers.
- [x] Canonical path traversal validation (`assertPathWithinDirectory`).
- [x] Content-Disposition header injection sanitization.
- [x] AI prompt injection boundary tags (`<UNTRUSTED_EVIDENCE_DATA>`).
- [x] 1MB JSON request body bound.
- [x] Bounded search queries (max 100 characters).
- [x] Centralized error sanitization preventing database credential exposure.

### Recommended Future Production Controls (Outside Current Application Scope):
1. **Multi-Instance Rate Limiting**: The current sliding-window limiter is in-process (single-instance). When scaling out behind a load balancer across multiple containers/nodes, migrate to a distributed Redis-backed rate limiter (e.g., `rate-limit-redis`).
2. **Reverse Proxy & TLS Termination**: Deploy behind Nginx, Cloudflare, or AWS ALB handling TLS 1.3 termination and WAF filtering.
3. **Key Management Service (KMS)**: Offload `JWT_SECRET` and database credentials to a secure secret store (e.g., AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault).
4. **Antivirus / Malware Scanning (ClamAV)**: Scan uploaded digital evidence files in an isolated quarantine sandbox before allowing downloads.
