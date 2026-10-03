# Reprova — Comprehensive Project Context & Technical Architecture

> **Document Status**: Complete Architecture & Codebase Audit (Post-Auth Removal)  
> **Target Version**: Next.js 14.1.0 (Frontend) / FastAPI 0.109.0 (Backend)  
> **Updated**: October 2026

---

## 1. Overview

### What the Site Does
**Reprova** is an automated, AI-powered Machine Learning paper reproducibility and audit platform. It addresses the reproducibility crisis in scientific research by bridging the gap between claims written in published academic papers and code implementations in public repositories:
- **Paper Parsing & Extraction**: Ingests paper PDFs, executes page-aware text chunking, and uses LLMs (via OpenRouter or Groq) to extract quantitative claims, claimed metrics, hyperparameters, datasets, and architectures.
- **AST & Code Inspection**: Clones and inspects GitHub repositories using Python AST parsing to locate declared architectures, configuration files, and hyperparameters.
- **Vector Retrieval & Matching**: Uses dense vector embeddings (via FastEmbed / Qdrant in-memory vector stores) to perform cosine-similarity matching between paper claims and repository code symbols or line ranges.
- **Deterministic Dependency Version Diffing**: Analyzes dependency manifests (`requirements.txt`, `environment.yml`, `pyproject.toml`) to detect dependency version drift between paper execution targets and runtime packages.
- **Traceability Graph**: Dynamically constructs interactive node-link traceability graphs connecting research claims to source code files and AST symbols.
- **Sandboxed Execution**: Runs reproduction experiments for curated papers (e.g. Llama 2, Mistral 7B, CLIP) with deterministic random seed configurations and evaluates reproduced vs. claimed metrics.
- **Automated PDF Audit Reports**: Generates downloadable PDF reproducibility reports using client-side `jsPDF`.

### Technology Stack
- **Frontend Framework**: [Next.js](https://nextjs.org/) 14.1.0 (App Router), React 18.2.0, TypeScript 5.3.3.
- **Styling**: Tailwind CSS 3.4.1, Framer Motion 14.0.0, Lucide React icons, custom glassmorphism and comet card UI components.
- **3D & Visuals**: Three.js (`three` 0.160.1), `@react-three/fiber` 8.18.0, OGL 1.0.11, Camera Controls.
- **Backend Framework**: [FastAPI](https://fastapi.tiangolo.com/) 0.109.0, Uvicorn 0.27.0, Python 3.10+.
- **Backend Libraries**: PyMuPDF (`fitz`), GitPython, FastEmbed 0.2.0, Qdrant-Client 1.7.0, HTTPX, Pydantic v2.
- **Database**: **None (Stateless Client Architecture)**. Analysis states are preserved client-side in `sessionStorage` and query parameters. MongoDB is not required.
- **Authentication**: **None (Completely Removed)**. Anyone can open the site, run analyses, and view reproducibility reports directly without login, registration, or OAuth.
- **Hosting & Infrastructure**: 
  - **Vercel**: Multi-service configuration via `vercel.json` (`frontend` service on Next.js, `backend` service on FastAPI ASGI, with internal service binding `BACKEND_URL`).
  - **Docker Compose**: Containerized multi-container setup via `docker-compose.yml` (`ml-paper-frontend` on port 3000, `ml-paper-backend` on port 8000).

### How to Run Locally

#### Option A: Running with Native Dev Servers
1. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Runs at: `http://localhost:8000` (Docs at `http://localhost:8000/docs`).

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Runs at: `http://localhost:3000`.

#### Option B: Running with Docker Compose
```bash
docker-compose up --build
```

---

## 2. Folder Structure

```text
Reprova-main/
├── .gitignore                          # Root Git ignore rules (node_modules, .env, build artifacts)
├── docker-compose.yml                  # Container orchestration for frontend & backend
├── PROJECT_CONTEXT.md                  # Comprehensive technical and architectural reference
├── REPROVA_COMPLETE_DOCUMENTATION.md   # Architectural, pipeline, and algorithmic documentation
├── REPROVA_SYSTEM_GUIDE.md             # Developer & system onboarding guide
├── vercel.json                         # Vercel multi-service routing and rewrite configuration
│
├── backend/                            # FastAPI Python ASGI Backend
│   ├── api/
│   │   ├── __init__.py                 # API package init
│   │   └── routes.py                   # REST endpoints (/health, /papers, /analyze, /execute, /graph)
│   ├── curated_papers/                 # Pre-configured benchmark papers for deterministic reproduction
│   │   ├── paper-clip/                 # OpenAI CLIP evaluation target & metadata
│   │   ├── paper-llama2/               # Meta Llama 2 evaluation target, eval.py & metadata
│   │   └── paper-mistral7b/            # Mistral 7B evaluation target & metadata
│   ├── models/
│   │   ├── __init__.py                 # Models package init
│   │   └── schemas.py                  # Pydantic schemas (Claim, Discrepancy, AnalyzeResponse, etc.)
│   ├── sandbox/                        # Containerized execution sandbox utilities
│   ├── services/                       # Core analysis engine services
│   │   ├── dependency_diff.py          # Deterministic package version drift detection
│   │   ├── execution.py                # Subprocess & container experiment execution harnesses
│   │   ├── extraction.py               # PDF text extraction and paper title detection
│   │   ├── graph.py                    # Node-link traceability graph builder
│   │   ├── llm/                        # LLM Provider integrations (OpenRouter, Groq)
│   │   ├── matching.py                 # Grounded claim-to-code similarity matching
│   │   ├── profiler.py                 # Pipeline execution performance profiler
│   │   ├── rag/                        # In-memory vector store (FastEmbed + Qdrant)
│   │   ├── repo_analysis.py            # Git cloning, AST file traversal, line chunking
│   │   ├── result_comparison.py        # Numerical metric difference calculator
│   │   └── root_cause.py               # Discrepancy root-cause classifier
│   ├── .dockerignore                   # Backend Docker ignore rules
│   ├── .env.example                    # Backend environment variable template (OpenRouter/Groq keys)
│   ├── Dockerfile                      # Backend container definition (Python 3.10 slim)
│   ├── main.py                         # FastAPI ASGI entrypoint, CORS setup, router mounting
│   └── requirements.txt                # Python dependencies
│
└── frontend/                           # Next.js 14 App Router Frontend
    ├── public/                         # Static assets (3D GLTF models, demo PDFs, background images)
    ├── src/
    │   ├── app/
    │   │   ├── analyze/                # Paper submission and analysis configuration page
    │   │   │   ├── AnalyzeClient.tsx   # Client component for custom PDF upload or curated paper selection
    │   │   │   └── page.tsx            # Public route entrypoint rendering AnalyzeClient
    │   │   ├── results/                # Analysis audit dashboard and report page
    │   │   │   ├── ResultsClient.tsx   # Client component rendering discrepancies, metrics, and report actions
    │   │   │   └── page.tsx            # Public route entrypoint rendering ResultsClient
    │   │   ├── globals.css             # Tailwind CSS global styles and dark theme tokens
    │   │   ├── layout.tsx              # Root HTML layout with GlobalBackground
    │   │   └── page.tsx                # Interactive landing page with 3D canvas and pipeline overview
    │   ├── components/                 # Reusable UI components
    │   │   ├── ui/                     # Aceternity and interactive motion UI primitives
    │   │   ├── ClaimCard.tsx           # Individual research claim verification card
    │   │   ├── DiscrepancyCard.tsx     # Discrepancy analysis and root-cause display card
    │   │   ├── Footer.tsx              # Application footer
    │   │   ├── FullscreenLoader.tsx    # Animated analysis progress loader
    │   │   ├── GlobalBackground.tsx    # Ambient background gradients and particle layer
    │   │   ├── Header.tsx              # Responsive top navigation header with "Start Analysis" CTA
    │   │   ├── MetricComparison.tsx    # Reported vs. reproduced numeric metric comparison table
    │   │   ├── Reveal.tsx              # Scroll-triggered entrance animation wrapper
    │   │   ├── SimpleAnalysis.tsx      # High-level summary view of audit results
    │   │   └── TraceabilityGraph.tsx   # Interactive 2D/3D claim-to-code traceability node graph
    │   ├── lib/
    │   │   ├── api.ts                  # HTTP client communicating with backend endpoints
    │   │   ├── pdf-report.ts           # Client-side PDF audit report generator (jsPDF)
    │   │   └── utils.ts                # Tailwind class merger utility (`cn`)
    │   ├── .dockerignore               # Frontend Docker ignore rules
    │   ├── .env.local.example          # Frontend environment variable template
    │   ├── Dockerfile                  # Frontend container definition (Node 18 alpine multi-stage)
    │   ├── next.config.js              # Next.js configuration (CORS headers, webpack rules)
    │   ├── package.json                # Frontend dependencies and npm scripts
    │   ├── tailwind.config.ts          # Tailwind styling tokens and animations
    │   └── tsconfig.json               # TypeScript compiler options
```

---

## 3. Routing & Pages

| Route / Path | Access Level | Component / File | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | **Public** | [`frontend/src/app/page.tsx`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/frontend/src/app/page.tsx) | Landing page with hero section, 3D visual effects, pipeline workflow steps, and direct links to `/analyze`. |
| `/analyze` | **Public** | Server: [`frontend/src/app/analyze/page.tsx`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/frontend/src/app/analyze/page.tsx)<br>Client: [`frontend/src/app/analyze/AnalyzeClient.tsx`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/frontend/src/app/analyze/AnalyzeClient.tsx) | Audit launcher page. Allows selecting curated benchmark papers or uploading custom PDF papers + public GitHub repository URLs. Directly accessible by anyone. |
| `/results` | **Public** | Server: [`frontend/src/app/results/page.tsx`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/frontend/src/app/results/page.tsx)<br>Client: [`frontend/src/app/results/ResultsClient.tsx`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/frontend/src/app/results/ResultsClient.tsx) | Full reproducibility dashboard displaying extracted claims, code evidence, root cause classifications, interactive traceability graph, and PDF report export. Directly accessible by anyone. |

---

## 4. Authentication Architecture (Decommissioned)

### Status: Completely Removed
Authentication has been **fully removed** from Reprova to allow seamless public access.
- **No Sign-In / Sign-Up**: The `/signin` and `/signup` routes and client components have been deleted.
- **No Route Guards**: Server-side guards (`requireAuth`, `redirectIfAuthenticated`) and client-side `useSession()` redirects have been removed. All routes are public.
- **No Auth Providers**: NextAuth.js handlers (`/api/auth/[...nextauth]`), registration endpoints (`/api/auth/register`), and `<AuthProvider>` wrappers have been removed.
- **No Database Dependency**: MongoDB and Mongoose/MongoClient are no longer used. The database was previously only utilized to persist user accounts.
- **Packages Removed**: `next-auth`, `bcryptjs`, `@types/bcryptjs`, `mongodb`, and `zod` have been uninstalled.

---

## 5. Data Flow & API Registry

### Data Flow Diagram

```text
[Browser / User]
       │
       ├─► 1. Navigates to /analyze (Public)
       │      │
       │      ├─► [Curated Mode]: Selects pre-packaged paper (e.g. Llama 2)
       │      │   └─► Redirects to /results?paper_id=paper-llama2
       │      │
       │      └─► [Custom Mode]: Submits PDF file + GitHub Repository URL
       │          └─► POST /api/analyze (multipart/form-data)
       │              └─► Response cached in client sessionStorage ('custom_analysis_result')
       │              └─► Navigates to /results?mode=custom
       │
       └─► 2. Views /results (Public)
              │
              ├─► Reads analysis results from backend or sessionStorage
              ├─► Fetches /api/analyze/{id}/graph for interactive 2D/3D visualization
              ├─► (Optional) Triggers /api/analyze/{id}/execute for containerized benchmark runs
              └─► Generates client-side PDF audit report via jsPDF
```

### API Endpoint Registry

All backend endpoints are hosted on the FastAPI ASGI service (`backend/api/routes.py`) and are publicly accessible:

| Endpoint | Method | Public / Auth | Handler / File | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | **Public** | `health()` in [`routes.py`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/backend/api/routes.py) | Service health check returning uptime and status. |
| `/api/papers` | `GET` | **Public** | `list_papers()` in [`routes.py`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/backend/api/routes.py) | Returns metadata for available curated benchmark papers. |
| `/api/analyze` | `POST` | **Public** | `analyze()` in [`routes.py`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/backend/api/routes.py) | Ingests PDF upload + repository URL; extracts claims, searches code, computes score. |
| `/api/analyze/{id}/execute` | `POST` | **Public** | `execute_paper()` in [`routes.py`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/backend/api/routes.py) | Runs benchmark reproduction experiment in sandboxed environment. |
| `/api/analyze/{id}/execute-multi-seed` | `POST` | **Public** | `execute_multi_seed()` in [`routes.py`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/backend/api/routes.py) | Runs multi-seed execution to measure metric variance. |
| `/api/analyze/{id}/graph` | `GET` | **Public** | `get_graph()` in [`routes.py`](file:///c:/Users/ghosh/Desktop/Reprova-main/Reprova-main/backend/api/routes.py) | Returns node-link traceability graph data for D3 / Three.js visualization. |

---

## 6. Dependencies Between Features & User Identity

- **Zero Identity Dependencies**: None of the features in Reprova require user identity.
- **Analysis Execution**: The pipeline (claim extraction, vector retrieval, repository AST parsing, dependency diffing, scoring) is completely deterministic and stateless.
- **Report Storage**: Analysis results are held in the browser's `sessionStorage` under `latest_reprova_analysis` and `custom_analysis_result`.
- **Exporting**: PDF reports are synthesized client-side directly from the in-memory analysis JSON.

---

## 7. Environment Variables & Configuration

### Frontend Environment Variables (`frontend/.env.local`)
| Variable Name | Required On | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Local Development | URL of the local FastAPI backend (`http://localhost:8000`). |
| `BACKEND_URL` | Vercel Deployment | Automatically injected by Vercel multi-service bindings to route `/api/*` traffic to the backend service. |

> **Unused / Removed Variables**: `MONGODB_URI`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_TRUST_HOST`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are no longer needed and can be safely deleted from any local or cloud environment.

### Backend Environment Variables (`backend/.env`)
| Variable Name | Required On | Description |
| :--- | :--- | :--- |
| `LLM_PROVIDER` | Local & Vercel | LLM provider selector (`openrouter` or `groq`). |
| `OPENROUTER_API_KEY` | Local & Vercel | API key for OpenRouter models. |
| `OPENROUTER_MODEL` | Local & Vercel | Primary model identifier (e.g. `liquid/lfm-2.5-2.6b:free`). |
| `GROQ_API_KEY` | Optional | API key for legacy Groq provider. |
| `GROQ_MODEL` | Optional | Groq model identifier (e.g. `openai/gpt-oss-120b`). |
| `RAG_CODE_SIMILARITY_THRESHOLD` | Optional | Vector similarity cutoff threshold for code matching (default `0.70`). |
| `EVAL_SEED` | Optional | Integer seed for sandbox experiment reproduction. |

---

## 8. Summary of Auth Decommissioning

| Component | Status | Details |
| :--- | :--- | :--- |
| **Route Guards** | **Removed** | `/analyze` and `/results` render directly without server or client checks. |
| **Auth Pages** | **Deleted** | `src/app/signin` and `src/app/signup` directories removed. |
| **NextAuth Handler** | **Deleted** | `src/app/api/auth` directory removed. |
| **Auth Libs** | **Deleted** | `src/lib/auth.ts`, `src/lib/auth-guard.ts`, `src/lib/validations.ts`, `src/lib/mongodb.ts`. |
| **Auth Components** | **Deleted** | `AuthProvider.tsx`, `UserMenu.tsx`, `AuthCard.tsx`, `GoogleButton.tsx`. |
| **Header CTA** | **Updated** | Displays direct, responsive "Start Analysis" button leading to `/analyze`. |
| **Database** | **Decommissioned** | MongoDB native driver and connection logic removed. Reprova is fully stateless. |
| **Dependencies** | **Pruned** | Removed `next-auth`, `bcryptjs`, `@types/bcryptjs`, `mongodb`, and `zod` from `package.json`. |
