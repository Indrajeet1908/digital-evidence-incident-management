# AI Data Flow & Security Architecture

This document specifies the privacy boundaries, data minimization controls, integrity guarantees, and security rules governing AI-assisted evidence and incident analysis in the Digital Evidence & Incident Management Platform.

---

## 1. What Enters AI Analysis

When an authorized user (`ADMIN`, `INVESTIGATOR`, or `ANALYST`) requests an AI analysis, only the following strictly scoped context is extracted:

- **Evidence Analysis (`POST /api/evidence/:id/ai/analyze`)**:
  - Evidence identifier reference (e.g. `EVD-2026-0001`) and original filename.
  - Evidence type classification (`DOCUMENT`, `LOG`, `EMAIL`).
  - Associated case number and case title.
  - Sanitized UTF-8 text content extracted from the evidence file, strictly truncated to `MAX_AI_INPUT_CHARACTERS` (default 50,000 characters).
  - Explicit analysis objective (`EVIDENCE_SUMMARY`, `IOC_EXTRACTION`, `THREAT_ANALYSIS`, `INVESTIGATION_SUMMARY`).

- **Incident Classification (`POST /api/incidents/:id/ai/classify`)**:
  - Incident number, title, and sanitized description.
  - Reported incident type, category, priority, and source.
  - Brief text summaries of associated evidence records (identifier and description only).

---

## 2. What Is Excluded

To protect privacy, confidentiality, and infrastructure integrity, the following data is **never** sent to an external AI provider:

1. **Authentication Data & Credentials**:
   - User passwords, password hashes (Argon2id), salt values, JWT tokens, and session headers.
2. **Database & Infrastructure Secrets**:
   - Database connection strings, PostgreSQL credentials, internal server IP addresses, ports, and configuration keys.
3. **Unrelated Case & Incident Telemetry**:
   - Evidence, notes, or case records from other investigations or unassociated cases.
4. **Raw Executable or Binary Content**:
   - Binary executables (`.exe`, `.elf`), disk images (`DISK_IMAGE`), memory dumps (`MEMORY_DUMP`), network packet captures (`NETWORK_CAPTURE`), and media binaries (`VIDEO`, `AUDIO`).
5. **PII of Uninvolved Parties**:
   - Unrelated user directory information, inactive users, and administrative account details.

---

## 3. How Evidence Integrity Is Verified

The platform enforces a mandatory **pre-flight cryptographic integrity check** before any evidence content is extracted or sent to an AI provider:

```
[Evidence Request]
        │
        ▼
[Load Evidence Record from DB]
        │
        ▼
[Check Physical File Exists on Disk]
   ├── Missing ──► [Fail with 500 & Log Missing File Alert]
        │
        ▼
[Stream Physical File & Calculate SHA-256 Checksum]
        │
        ▼
[Compare Calculated SHA-256 == Stored evidence.sha256]
   ├── Mismatch ──► [ABORT IMMEDIATELY (409 Conflict)]
   │                [Record AI_ANALYSIS_FAILED Audit Entry]
   │                [AI Provider IS NEVER CALLED]
        │
        ▼ Match
[Preprocess Text & Proceed to AI Submission]
```

**Security Invariant**: The AI provider will **never** receive or analyze an evidence file whose physical on-disk SHA-256 does not match the tamper-evident database hash recorded at initial ingestion.

---

## 4. How Data Is Minimized & Normalized

Before passing content to the AI abstraction layer:

1. **Format Validation**: Files are checked for null bytes (`0x00`) in the header; binary payloads are rejected with `422 Unprocessable Entity`.
2. **Whitespace Normalization**: Windows CRLF line endings are converted to standard newlines (`\n`) and superfluous whitespace is trimmed.
3. **Size Clamping**: Content exceeding `MAX_AI_INPUT_CHARACTERS` is truncated with a deterministic warning marker appended, bounding token exposure and preventing denial-of-service/buffer exhaustion.
4. **Deterministic Input Hashing**: A SHA-256 hash (`inputHash`) is calculated over the exact normalized string sent to the AI. This establishes mathematical proof of what was analyzed versus what was physically stored in evidence (`evidence.sha256`).

---

## 5. How AI Results Are Stored

The response from an AI provider is treated as **untrusted external input** and must pass strict validation before persistent storage:

1. **Zod Schema Validation**: The raw output must conform to `structuredAIOutputSchema`:
   - `summary`: Non-empty string (1–5000 chars)
   - `classification`: Classification label (1–100 chars)
   - `severity`: Valid enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, `UNKNOWN`)
   - `confidence`: Normalized float between `0.0` and `1.0`
   - `findings`: Array of validated finding objects
   - `indicators`: Array of validated indicator objects (`IP`, `DOMAIN`, `URL`, `EMAIL`, `HASH`, `FILE`, `OTHER`)
   - `recommendedActions`: Array of actionable investigation recommendations
2. **Failure Containment**: If the AI response is malformed, invalid JSON, or fails Zod parsing:
   - The analysis record status is transitioned to `FAILED`.
   - A sanitized error message is stored (without internal provider stack traces).
   - An `AI_ANALYSIS_FAILED` audit log is appended.
   - The invalid payload is **never** saved as a successful analysis.
3. **Immutability & Audit**: Each completed analysis is saved in the `ai_analyses` table with `status: COMPLETED`, `inputHash`, `provider`, `model`, `confidence`, and `completedAt`.

---

## 6. How API Keys Are Protected

- **Server-Side Only**: AI provider API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) exist solely in the server environment variables.
- **No Frontend Exposure**: Keys are never transmitted in API responses, headers, or client bundles.
- **Log Redaction**: Providers utilize error sanitizers that strip API keys from error messages, stack traces, and network logs.
- **Client Parameters Restricted**: Clients cannot specify arbitrary API keys, custom endpoints, or raw provider prompts in request payloads. The server manages all prompt construction and provider selection.

---

## 7. What AI Is and Is Not Allowed to Do

### What AI Is Allowed to Do:
- Synthesize readable executive summaries of text logs and documents.
- Extract candidate Indicators of Compromise (IPs, domains, hashes, URLs) from evidence text.
- Identify potential threat patterns and suspicious activity descriptions.
- Propose recommended investigation steps for human review.

### What AI Is NOT Allowed to Do:
- **No Autonomous Enforcement**: The AI cannot block IP addresses, quarantine endpoints, or disable accounts.
- **No Database Modification**: The AI cannot modify incident status, alter case severity, change evidence metadata, or delete records.
- **No File Mutation**: The AI cannot modify original evidence files or recalculate/overwrite evidence SHA-256 checksums.
- **No Code Execution**: Uploaded evidence files are never executed, compiled, evaluated as JavaScript/TypeScript, or run in shells.
- **Advisory Assistance Only**: AI outputs are designated as advisory assistance. Human investigators remain solely responsible for findings and investigation conclusions.
