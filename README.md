# AI-Assisted Digital Evidence & Incident Management Platform

A production-style platform for SOC Tier 2 cybersecurity investigators to upload, organize, verify, analyze, and report digital evidence while maintaining chain of custody and supporting collaboration.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (via Docker) |
| ORM | Prisma |
| Auth | JWT, Argon2 |
| Validation | Zod |
| AI | OpenAI / Gemini API (Phase 2) |

## Getting Started

### Prerequisites

- Node.js v18+
- npm
- Git
- Docker Desktop (for PostgreSQL)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd digital-evidence-platform

# Backend
cd server
cp ../.env.example ../.env
npm install
npm run dev

# Frontend (in a new terminal)
cd client
npm install
npm run dev
```

### Access

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

## Project Structure

```
digital-evidence-platform/
├── client/          # React frontend
├── server/          # Express backend
├── storage/         # Evidence file storage
│   └── evidence/
├── docs/            # Documentation
├── .env.example     # Environment variable template
├── .gitignore
└── README.md
```

## Development Phases

1. **Phase 1** — Core Platform (Auth, Cases, Incidents, Evidence, Dashboard)
2. **Phase 2** — AI Integration (Classification, Summarization, IOC Extraction)
3. **Phase 3** — Investigation Intelligence (Timeline, Findings, Tasks)
4. **Phase 4** — Reporting (PDF Export, Evidence Summary)
5. **Phase 5** — Security Hardening
6. **Phase 6** — Testing & Deployment
