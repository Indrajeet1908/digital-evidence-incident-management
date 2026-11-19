# Digital Evidence Platform — Testing Strategy & Verification Guide

## 1. Overview & Test Pyramid

The Digital Evidence Platform enforces rigorous, automated verification across the entire stack. Every milestone builds on an immutable regression suite ensuring forensic integrity, security boundaries, and operational stability.

```
                  ┌───────────────────────────────┐
                  │    E2E Smoke Verification     │
                  │  (Manual / Deployment Flow)  │
                  ├───────────────────────────────┤
                  │   Production Readiness Suite  │
                  │   (Health, Ready, Tracing)    │
                  ├───────────────────────────────┤
                  │   Security Hardening Suite    │
                  │  (BOLA, IDOR, Headers, Rate)  │
                  ├───────────────────────────────┤
                  │    API & Integration Tests    │
                  │ (Auth, RBAC, Cases, Custody)  │
                  ├───────────────────────────────┤
                  │   Unit & Validator Schemas    │
                  │ (Zod, SHA-256, Filename San.) │
                  └───────────────────────────────┘
```

---

## 2. Test Suites Inventory & Current Baseline

The regression test suite currently contains **11 automated test suites** totaling **372 tests** with a **100% pass rate (0 failures)**:

| Suite # | Suite Name | Test File | Test Count | Scope & Coverage |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Authentication | `test/auth.test.ts` | **15** | Registration, login, Argon2 hashing, token issuance, inactive user lock-out, no enumeration |
| **2** | RBAC Access Control | `test/rbac.test.ts` | **22** | Hierarchical roles (ADMIN, INVESTIGATOR, ANALYST, VIEWER), role tampering, spoofing |
| **3** | Case Management | `test/case.test.ts` | **34** | Case CRUD, status audit history, priority/severity filtering, member assignment |
| **4** | Incident Management | `test/incident.test.ts` | **32** | Security incident lifecycle, case linkage, status history, automated timestamps |
| **5** | Evidence Management | `test/evidence.test.ts` | **47** | Evidence upload, SHA-256 calculation, UUID filename storage, path traversal, downloads |
| **6** | Chain of Custody & Audit | `test/custody.test.ts` | **42** | Append-only custody logs, SHA-256 hash chains, transfer/receive, sealing, audit verification |
| **7** | AI Analysis | `test/ai.test.ts` | **30** | Provider abstraction, pre-flight hash integrity, prompt isolation, advisory labeling |
| **8** | Investigator Dashboard | `test/dashboard.test.ts` | **37** | Overview metrics, incident intelligence, evidence stats, unified multi-entity search |
| **9** | Reporting & Export | `test/reporting.test.ts` | **55** | Stateless report generation, PDF rendering, distinct report SHA-256 hash, disclaimers |
| **10** | Security Hardening | `test/security-hardening.test.ts` | **40** | HTTP headers (CSP, HSTS), CORS whitelist, sliding-window rate limiters, BOLA/IDOR defenses |
| **11** | Production Readiness | `test/production-readiness.test.ts` | **18** | Liveness probe, readiness probe (200/503), X-Request-Id tracing, secret length, storage isolation |
| **TOTAL** | **Full Platform Suite** | | **372 passed** | **0 failed (100% Passing)** |

---

## 3. Running Automated Tests

All tests execute against the backend Express application and PostgreSQL container (`dep-postgres` on host port `5433`).

```bash
# Execute entire 11-suite regression suite:
cd server
npm test

# Execute individual suites:
npm run test:auth          # Suite 1: Authentication (15 tests)
npm run test:rbac          # Suite 2: Role-Based Access Control (22 tests)
npm run test:case          # Suite 3: Case Management (34 tests)
npm run test:incident      # Suite 4: Incident Management (32 tests)
npm run test:evidence      # Suite 5: Evidence Management (47 tests)
npm run test:custody       # Suite 6: Custody & Audit (42 tests)
npm run test:ai            # Suite 7: AI-Assisted Analysis (30 tests)
npm run test:dashboard     # Suite 8: Investigator Dashboard (37 tests)
npm run test:reporting     # Suite 9: Reporting & PDF Export (55 tests)
npm run test:security      # Suite 10: Security Hardening & BOLA (40 tests)
npm run test:readiness     # Suite 11: Production Readiness & Health (18 tests)
```

---

## 4. Test Environment Isolation & Mock AI Provider

### 1. Zero External API Dependency
- When running in test mode (`NODE_ENV=test`), `config.aiProvider` resolves automatically to `MockAIProvider`.
- Tests never make external calls to Google Gemini or OpenAI APIs.
- Zero API credits or external internet access required for testing.

### 2. Isolated Test Data
- Test suites generate unique, timestamped email addresses (`test.<role>.<timestamp>@evidence-platform.local`).
- Every test suite uses isolated UUIDs for cases, incidents, and evidence.
- No test relies on hardcoded primary keys.

---

## 5. End-to-End Operational Smoke Test Protocol

For verifying a newly deployed instance without destructive reset:

1. **Service Verification**:
   - Query `GET /api/health` $\rightarrow$ Expect `200 OK` (`status: "ok"`, `database: "connected"`).
   - Query `GET /api/ready` $\rightarrow$ Expect `200 OK` (`database: "connected"`, `storage: "accessible"`).
2. **Authentication Flow**:
   - Register an administrator account via `POST /api/auth/register`.
   - Log in via `POST /api/auth/login`; verify JWT token received in response.
3. **Investigation Workflow**:
   - Create a case via `POST /api/cases`.
   - Create an incident linked to the case via `POST /api/incidents`.
   - Upload evidence file via `POST /api/evidence` (multipart/form-data).
   - Verify SHA-256 checksum returned matches local file SHA-256.
4. **Custody & Audit**:
   - Transfer custody via `POST /api/evidence/:id/custody/transfer`.
   - Acknowledge custody via `POST /api/evidence/:id/custody/receive`.
   - Verify custody chain integrity via `GET /api/evidence/:id/custody/integrity` $\rightarrow$ `VALID`.
5. **AI Analysis & Reporting**:
   - Request analysis via `POST /api/evidence/:id/ai/analyze` $\rightarrow$ Check advisory disclaimer.
   - Generate report preview via `POST /api/reports/preview`.
   - Export report PDF via `POST /api/reports/export`; verify binary PDF stream and distinct `reportHash`.
6. **Authorization Check**:
   - Register a `VIEWER` account.
   - Attempt `POST /api/reports/export` or `POST /api/evidence/:id/custody/transfer` $\rightarrow$ Expect `403 Forbidden`.
