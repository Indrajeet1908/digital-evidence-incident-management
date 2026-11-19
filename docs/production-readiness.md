# Digital Evidence Platform — Production Readiness & Operations Guide

## 1. Production Readiness Matrix

| Domain | Control Area | Status | Notes & Requirements |
| :--- | :--- | :---: | :--- |
| **Authentication** | Password Hashing | **READY** | Argon2id hashing with randomized salts. |
| **Authentication** | JWT Security | **READY** | Server-side signing; requires $\ge 32$ character secret in production. |
| **Authorization** | Role-Based Access Control | **READY** | Strict 4-tier model (ADMIN, INVESTIGATOR, ANALYST, VIEWER). |
| **Authorization** | BOLA / IDOR Protection | **READY** | Case roster changes restricted to ADMIN or lead investigator. Custody receipt hijacking blocked. |
| **Integrity** | SHA-256 File Checksums | **READY** | Pre-flight calculation, immutable database storage, live verification. |
| **Integrity** | Hash Chains | **READY** | Sequential SHA-256 chains on custody events and audit trails. |
| **Immutability** | Evidence File Protection | **READY (App-level)** | Application-level evidence immutability is enforced. Deletions strictly prohibited in API. |
| **Security** | HTTP Headers | **READY** | Environment-aware CSP, HSTS, X-Frame-Options DENY, nosniff, no X-Powered-By. |
| **Security** | Rate Limiting | **READY** | Sliding-window limiters for Auth, AI, Reports, Search, and General API. |
| **Reporting** | Stateless PDF Generation | **READY** | Stateless compilation, distinct report hash, mandatory advisory disclaimers. |
| **Observability** | Health & Readiness | **READY** | `/api/health` liveness probe and `/api/ready` readiness probe (200/503 contract). |
| **Observability** | Request Tracing | **READY** | `X-Request-Id` UUID generation and propagation across requests. |
| **Deployment** | Multi-Stage Containers | **READY** | Production Dockerfiles for backend and frontend with non-root runtime users. |
| **Deployment** | Network Isolation | **READY** | `docker-compose.production.yml` isolates PostgreSQL on internal `db-net` (no host port). |
| **Operations** | Database Migrations | **NEEDS CONFIGURATION** | Decoupled execution: `npx prisma migrate deploy` must run before app container starts. |
| **Operations** | TLS / HTTPS Certificates | **NEEDS CONFIGURATION** | Production reverse proxy requires valid TLS certificate from internal CA or Let's Encrypt. |
| **Operations** | CORS Whitelist | **NEEDS CONFIGURATION** | `CORS_ORIGIN` must be configured with production web domains. |
| **Storage** | True Hardware/Cloud WORM | **FUTURE IMPROVEMENT** | Application enforces immutability, but hardware-level WORM (e.g. S3 Object Lock) is recommended for cloud. |
| **Scalability** | Distributed Rate Limiting | **FUTURE IMPROVEMENT** | In-memory sliding window works on single instance; Redis required for multi-replica horizontal clustering. |

---

## 2. Production Deployment Architecture

```
Internet / Corporate WAN
           │
           ▼ (HTTPS / 443)
┌────────────────────────────────────────────────────────┐
│           Nginx Reverse Proxy / Load Balancer          │
│                                                        │
│ • TLS 1.2/1.3 Termination                              │
│ • Client body limit: 100MB (Evidence uploads)          │
│ • Sets X-Forwarded-For, X-Forwarded-Proto, X-Request-Id│
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼ (port 80)                     ▼ (port 5000)
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     Frontend Web Service      │   │      Backend API Service      │
│      (dep-prod-frontend)      │   │      (dep-prod-backend)       │
│                               │   │                               │
│ • React SPA static assets     │   │ • Node.js 20 Alpine           │
│ • Nginx alpine (unprivileged) │   │ • Runs as non-root user (node)│
│ • SPA fallback routing        │   │ • Readiness: /api/ready       │
│ • Network: frontend-net       │   │ • Networks: backend-net,db-net│
└───────────────────────────────┘   └───────────────┬───────────────┘
                                                    │ (port 5432)
                                                    ▼
                                    ┌───────────────────────────────┐
                                    │      PostgreSQL Database      │
                                    │      (dep-prod-postgres)      │
                                    │                               │
                                    │ • NO EXPOSED HOST PORTS       │
                                    │ • Internal network only: db-net│
                                    │ • Volume: pgdata-prod         │
                                    └───────────────────────────────┘
```

---

## 3. Database Migration Policy

### Strict Decoupled Migration Strategy
The backend application container **does NOT execute automated migrations on startup**. This prevents race conditions during multi-instance scaling and ensures schema changes are applied intentionally and reversibly by administrators.

#### Production Deployment Sequence:
1. **Apply Migrations**:
   ```bash
   docker compose -f docker-compose.production.yml run --rm backend npx prisma migrate deploy
   ```
2. **Start Services**:
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```
3. **Verify Readiness**:
   ```bash
   curl -I http://localhost/api/ready
   # Expected: HTTP/1.1 200 OK
   ```

*Rule: Never execute `prisma db push` or `prisma migrate reset` in staging or production environments.*

---

## 4. Evidence Immutability & Retention

### 1. Application-Level Immutability (Enforced)
- The platform strictly enforces evidence immutability at the application layer:
  - There is **no DELETE endpoint** for evidence records in the API.
  - Updating evidence metadata is restricted to non-system fields (`description`, `source`).
  - Stored SHA-256 checksums, evidence numbers, and case associations are immutable.
  - Physical files on disk are stored using server-generated UUIDs with extension `.bin`.

### 2. Physical & Object Storage Immutability (Future Target)
- Local filesystem mounts and standard Docker volumes do not provide true physical WORM (Write-Once-Read-Many) hardware guarantees.
- For high-consequence jurisdictional compliance, it is recommended to pair the platform with external immutable object storage (such as AWS S3 Object Lock in Compliance Mode or Google Cloud Storage Bucket Lock with retention policies).

---

## 5. Backup, Recovery & Disaster Recovery Targets

### 1. Coordinated Recovery Unit
In digital forensics, **the database and evidence filesystem form a single, coordinated recovery unit**:
- Restoring a database snapshot without the matching filesystem yields orphaned database records whose integrity verification fails.
- Restoring evidence files without matching database records yields unverifiable files lacking custody chains and audit logs.
- All backups must bundle both database logical dumps and storage directory archives under a single cryptographic manifest.

### 2. Proposed Production Recovery Targets
The following are **proposed operational targets** to be validated against actual deployment infrastructure:
- **Proposed RTO (Recovery Time Objective)**: $< 2$ hours (spinning up a replica environment from a verified coordinated backup bundle).
- **Proposed RPO (Recovery Point Objective)**: $< 24$ hours (daily scheduled off-peak coordinated backup).

### 3. Backup Execution Runbook
```bash
# Execute coordinated backup using the provided utility script:
./scripts/backup.sh

# Verify output:
# 1. database_YYYYMMDD_HHMMSS.dump
# 2. evidence_YYYYMMDD_HHMMSS.tar.gz
# 3. manifest_YYYYMMDD_HHMMSS.sha256
```

### 4. Restoration Runbook
```bash
# Restore to target instance (requires operator verification):
./scripts/restore.sh ./backups/dep_backup_YYYYMMDD_HHMMSS
```

---

## 6. Dependency & Supply Chain Security Findings

As evaluated via `npm audit`:

| Package | Classification | Status & Mitigation |
| :--- | :---: | :--- |
| `mysql2` | **Non-blocking / Transitive** | Transitive development dependency in `@prisma/config` / `prisma` dev CLI. The platform uses PostgreSQL exclusively. Running `npm audit fix --force` would downgrade Prisma from 7.10 to 6.x (breaking change). **Keep pinned to 7.10.** |
| `deepmerge-ts` | **Non-blocking / Transitive** | Transitive build-time dependency in Prisma CLI. Does not affect runtime Express API server. |
| `source-map-js` | **Non-blocking / Transitive** | Dev dependency used by Vite during frontend static asset build. Does not ship in production bundle. |
| **Core Runtime Dependencies** | **CLEAN** | `express`, `argon2`, `jsonwebtoken`, `zod`, `pdfkit`, `pg`, `@prisma/client` contain **0 known vulnerabilities**. |

*Future Remediation: Re-evaluate dev dependencies when Prisma releases stable 7.x CLI patches addressing upstream transitive dependencies.*
