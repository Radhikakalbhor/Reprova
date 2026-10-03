# REPROVA — Comprehensive System & Architectural Guide
> **Purpose**: A self-contained, master technical reference designed for handing off to AI assistants (e.g., Claude) or developers to implement frontend features, animations, and redesigns with full context.

---

## 1. Project Overview & Value Proposition

* **Project Name**: Reprova
* **Tagline**: *"See beyond the paper. Turn research claims into reproducible evidence."*
* **Core Problem**: Hundreds of AI/ML papers are published monthly with claimed benchmark scores (ImageNet accuracy, perplexity, BLEU, F1). However, reproducing them is notoriously difficult due to undocumented hyperparameter defaults, library version drift, missing random seed controls, and disconnected GitHub codebases.
* **The Solution**: An automated research verification and code reproducibility auditing platform that:
  1. Parses empirical claims directly from research paper PDFs (datasets, architectures, hyperparameters, evaluation metrics).
  2. Shallow-clones and parses GitHub repositories using AST structural chunking and line-bounded extraction.
  3. Deterministically compares 3-way dependencies (Paper Expected vs. Repo Declared vs. Installed Environment).
  4. Matches paper claims to concrete code locations using dense ONNX vector search + LLM semantic reasoning.
  5. Computes a deterministic, **importance-weighted reproducibility score (0.0 to 100.0)**.
  6. Executes sandboxed benchmark evaluations (Docker containers with local CPU subprocess fallbacks) and multi-seed variance simulations across random seeds.
  7. Tags discrepancies with 6 root-cause categories and actionable remediation suggestions.
  8. Renders visual traceability graphs, dynamic comparison dashboards, and client-generated PDF reports.

---

## 2. Technology Stack

### Frontend
* **Framework**: Next.js 14.1.0 (App Router, Server Components + Client Hooks)
* **Language**: TypeScript 5.3 + React 18.2
* **Styling**: Tailwind CSS 3.4.1 + Vanilla CSS design tokens (`globals.css`)
* **Icons & Visuals**: Lucide React + Custom SVG Graph
* **PDF Exporter**: `jspdf` 4.2.1 + `jspdf-autotable` 5.0.8 (client-side generation)
* **Default Port**: `http://localhost:3000`

### Backend
* **Framework**: FastAPI 0.110 + Uvicorn 0.28 (ASGI server)
* **Language**: Python 3.11+ / 3.14
* **PDF Extraction**: PyMuPDF (`pymupdf` / `fitz`) with block layout analysis
* **Repository Analysis**: Git CLI, Python `ast` parser, windowed code chunking
* **Embeddings & Vector Database**: FastEmbed 0.8.1 (`BAAI/bge-small-en-v1.5`, 384-dim ONNX) + Ephemeral in-memory Qdrant (`QdrantClient(":memory:")`)
* **LLM Engine**: OpenRouter API (`openrouter/free` router) via `httpx` (with dormant Groq fallback)
* **Sandbox / Execution**: Docker SDK 7.0 + Standalone CPU subprocess fallback
* **Default Port**: `http://localhost:8000`

---

## 3. High-Level Architecture & Data Flow

```
[ Research Paper PDF / Curated ID ]          [ GitHub Repository URL ]
                 │                                      │
                 ▼                                      ▼
       [ 1. PyMuPDF Extraction ]               [ 2. AST Code Chunker ]
                 │                                      │
                 ▼                                      ▼
    [ FastEmbed Vector Indexing ]           [ FastEmbed Code Indexing ]
                 │                                      │
                 └──────────────┬───────────────────────┘
                                │
                                ▼
         [ 3. Deterministic 3-Way Dependency Diff ]
       (Paper Expected vs. Repo Declared vs. Installed)
                                │
                                ▼
         [ 4. Semantic Claim-to-Code Matching ]
           (Cosine Similarity Gating + OpenRouter)
                                │
                                ▼
       [ 5. Deterministic Weighted Scoring (0-100) ]
        (High: 3.0 wt, Medium: 2.0 wt, Low: 1.0 wt)
                                │
                                ▼
        [ 6. Sandboxed Execution & Multi-Seed Run ]
      (Docker Container / Local CPU Subprocess Sandbox)
                                │
                                ▼
        [ 7. Root-Cause Tagging & Remediation Engine ]
                                │
                                ▼
         [ 8. FastAPI Response (/analyze JSON) ]
                                │
                                ▼
     =======================================================
                        FRONTEND LAYER
     =======================================================
     [/]         Landing Page (Hero, Flow, Capabilities)
     [/analyze]  Submission Form (Curated / Custom Dropzone)
     [/results]  Audit Dashboard:
                 ├── Weighted Score Gauge
                 ├── Claims & Code Matches
                 ├── Sandboxed Execution & Metric Comparison
                 ├── Multi-Seed Variance Analysis
                 ├── Discrepancies & Remediation Actions
                 ├── 3-Way Dependency Matrix
                 ├── Visual Traceability Map (Bipartite Graph)
                 └── Client PDF Download (`jspdf`)
```

---

## 4. Directory & File Structure

```
Reprova-main/
├── docker-compose.yml              # Multi-container definition (frontend + backend)
├── REPROVA_SYSTEM_GUIDE.md         # This technical guide
├── REPROVA_COMPLETE_DOCUMENTATION.md# Master specification document
├── backend/
│   ├── main.py                     # FastAPI entrypoint, CORS setup, Windows Git auto-detection
│   ├── requirements.txt            # Python dependencies
│   ├── api/
│   │   └── routes.py               # REST API endpoints (/health, /papers, /analyze, /graph)
│   ├── models/
│   │   └── schemas.py              # Pydantic schemas (Claim, Discrepancy, AnalyzeResponse)
│   ├── services/
│   │   ├── extraction.py           # PDF parsing and grounded claim extraction
│   │   ├── repo_analysis.py        # Git cloning, AST analysis, symbol classification
│   │   ├── matching.py             # Claim-to-code similarity matching and scoring
│   │   ├── dependency_diff.py      # Deterministic 3-way manifest version matrix parser
│   │   ├── execution.py            # Docker runner with safe local CPU sandbox fallback
│   │   ├── result_comparison.py    # Metric comparison tolerances & multi-seed stats
│   │   ├── root_cause.py           # 6-category root cause classification & fix generator
│   │   ├── graph.py                # Bipartite node/edge graph data builder
│   │   ├── profiler.py             # Pipeline execution timing and stage profiler
│   │   ├── rag/                    # Vector store, chunkers, embeddings, retriever
│   │   └── llm/                    # OpenRouter and Groq provider abstraction
│   └── curated_papers/             # Benchmark evaluation targets
│       ├── paper-llama2/           # Llama 2 evaluation target (eval.py, Dockerfile, metadata.json)
│       ├── paper-mistral7b/        # Mistral 7B target (eval.py, Dockerfile, metadata.json)
│       └── paper-clip/             # CLIP target (eval.py, Dockerfile, metadata.json)
└── frontend/
    ├── package.json                # Next.js, React, Tailwind, jsPDF, Lucide
    ├── tailwind.config.ts          # Tailwind CSS theme configuration
    ├── postcss.config.js           # PostCSS configuration
    ├── tsconfig.json               # TypeScript configuration
    ├── public/                     # Static media assets (videos, posters)
    └── src/
        ├── app/
        │   ├── layout.tsx          # Root HTML layout with dark theme & typography
        │   ├── globals.css         # Design tokens, link resets, SVG containment
        │   ├── page.tsx            # Landing page (Hero, Video, 6-Step Workflow, Features)
        │   ├── analyze/
        │   │   └── page.tsx        # Paper submission form (Curated selector / Custom upload)
        │   └── results/
        │       └── page.tsx        # Dashboard (Structured Report, Traceability Map, Simple View)
        ├── components/
        │   ├── Header.tsx          # Top navigation with live backend health indicator
        │   ├── Footer.tsx          # Standard footer with navigation links
        │   ├── HeroVisual.tsx      # Interactive hero preview card (reads sessionStorage)
        │   ├── ScrollVideo.tsx     # Full-bleed video background
        │   ├── Reveal.tsx          # Scroll-triggered entrance animations
        │   ├── SimpleAnalysis.tsx  # Plain-language executive breakdown tab
        │   └── TraceabilityGraph.tsx# SVG bipartite graph connecting claims to code files
        └── lib/
            ├── api.ts              # TypeScript interfaces & backend REST client
            └── pdfGenerator.ts     # Production-grade PDF report generator
```

---

## 5. API Endpoints & Data Contract

All API routes live in `backend/api/routes.py`. The frontend communicates with `http://localhost:8000`:

| Endpoint | Method | Input | Output / Purpose |
| :--- | :---: | :--- | :--- |
| `/health` | `GET` | None | Checks backend health: `{"status": "ok", "service": "...", "rag_enabled": true}` |
| `/papers` | `GET` | None | Lists available curated paper targets (`paper-llama2`, `paper-mistral7b`, `paper-clip`) |
| `/analyze` | `POST` | `FormData` (file, repo_url, mode) OR JSON (`{"paper_id": "paper-llama2"}`) | Executes complete analysis pipeline and returns full `AnalyzeResponse` JSON |
| `/analyze/{paper_id}/execute` | `POST` | `paper_id` in path | Triggers benchmark execution for a single curated target |
| `/analyze/{paper_id}/execute-multi-seed` | `POST` | `paper_id` in path | Triggers multi-seed benchmark execution (seeds: `42`, `123`, `456`) |
| `/analyze/{paper_id}/graph` | `GET` | `paper_id` in path | Returns node and edge graph data for visual traceability |

---

## 6. The Master Response Object (`AnalyzeResponse`)

Every call to `POST /analyze` returns this TypeScript-typed JSON structure (defined in `frontend/src/lib/api.ts`):

```typescript
export interface AnalyzeResponse {
  paper_id?: string;
  paper_title?: string;
  repo_url?: string;
  reproducibility_score: number | null; // 0.0 to 100.0 (or null if repo analysis failed)
  execution_status?: string;            // 'curated_analysis_completed' | 'custom_analysis_completed'

  // 1. CLAIMS LIST
  claims: Array<{
    id: string;                         // e.g. 'claim-llama2-1'
    description: string;                // Claim description text
    status: 'matched' | 'partial_match' | 'conflicting' | 'not_found' | 'verified';
    importance: 'high' | 'medium' | 'low'; // High = 3.0 wt, Medium = 2.0 wt, Low = 1.0 wt
    weight: number;                     // 3.0, 2.0, or 1.0
    earned_points: number;              // matched = 1.0 * wt, partial = 0.5 * wt, unmatched = 0.0
    confidence: 'high' | 'medium' | 'low'; // Extraction certainty from paper
    paper_reference?: string;           // Verbatim quote from paper
    citation?: string;                  // Page & section reference
    page_number?: number;
    section?: string;
    matched_file?: string;              // e.g. 'llama/model.py'
    start_line?: number;                // e.g. 32
    end_line?: number;                  // e.g. 45
    symbol_name?: string;               // e.g. 'RMSNorm'
    matched_value?: string;             // Code snippet or hyperparameter value
    similarity_score?: number;          // Cosine similarity float
    reasoning?: string;                 // Detailed match or mismatch explanation
    rejected_candidate?: {              // Nearest retrieval candidate rejected by threshold
      file_path: string;
      similarity_score?: number;
      reason: string;
    };
  }>;

  // 2. DISCREPANCIES & REMEDIATION
  discrepancies: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location?: string;                  // e.g. 'configs/train.yaml:L14'
    root_cause:                         // 6 Standard Root Causes:
      | 'missing_hyperparameter'
      | 'dataset_split_difference'
      | 'dependency_version_drift'
      | 'seed_variance'
      | 'undocumented_default'
      | 'insufficient_evidence';
    root_cause_explanation?: string;
    fix_suggestion?: string;            // Concrete remediation instructions
    dependency_evidence?: {             // Present if root_cause is dependency_version_drift
      package_name: string;
      expected_version?: string;
      declared_version?: string;
      installed_version?: string;
      source_file?: string;
      comparison_status: 'VERIFIED_DRIFT' | 'MATCHED' | string;
    };
  }>;

  // 3. DETERMINISTIC DEPENDENCY DIFF (3-Way Version Matrix)
  dependency_diff?: Array<{
    package_name: string;
    expected_version?: string;          // Paper reported
    declared_version?: string;          // repo requirements.txt / yml
    installed_version?: string;         // local container / env
    source_file?: string;
    comparison_status: 'VERIFIED_DRIFT' | 'MATCHED' | 'DECLARED_VERSION_UNKNOWN';
  }>;

  // 4. SANDBOXED EXECUTION & MULTI-SEED METRICS
  execution_result?: {
    status: 'success' | 'timeout' | 'error' | 'skipped';
    execution_time_seconds?: number;
    raw_output?: string;                // stdout/stderr from container
    parsed_metrics?: Record<string, number>;
    comparison?: {
      overall_verdict: 'reproduced' | 'partially_reproduced' | 'reproduction_failed';
      summary: string;
      comparisons: Array<{
        metric: string;
        claimed: number;
        reproduced: number | null;
        difference_pct: number | null;
        verdict: 'match' | 'partial' | 'mismatch';
      }>;
    };
    multi_seed_execution?: {
      supports_multi_seed: boolean;
      seeds_used?: number[];            // [42, 123, 456]
      runs?: Array<{
        seed: number;
        status: string;
        parsed_metrics?: Record<string, number>;
        execution_time_seconds?: number;
      }>;
      metrics_summary?: Array<{
        metric: string;
        claimed_value: number;
        mean_val?: number;
        range_str?: string;             // e.g. "0.929 – 0.938"
        std_dev?: number;
        variance_level?: 'low' | 'medium' | 'high' | 'unavailable';
        interpretation_code: 'reproduced_consistently' | 'reproduced_within_variance' | 'outside_variance' | 'failed_consistently';
        interpretation_summary: string;
      }>;
    };
  };

  // 5. TRACEABILITY GRAPH (Bipartite Nodes & Edges)
  graph_data?: {
    nodes: Array<{
      id: string;
      type: 'paper_claim' | 'code_file';
      label: string;
      evidence?: string;
      category?: string;
      confidence?: string;
    }>;
    edges: Array<{
      source: string;                   // Claim ID
      target: string;                   // File ID
      status: 'matched' | 'partial_match' | 'conflicting' | 'not_found';
    }>;
  };
}
```

---

## 7. How the Frontend Operates

### Page Routes
1. **`/` (Landing Page)**:
   * Header with live API ping (`/health`).
   * Video hero section with claim-to-code teaser.
   * `HeroVisual`: Interactive dynamic preview component that displays sample claims from `sessionStorage` or defaults.
   * 6-step workflow explanation.
   * Core capability cards.
   * Footer with navigation links.

2. **`/analyze` (Submission Form)**:
   * Mode toggle: **Curated Paper** (Llama 2, Mistral 7B, CLIP) vs. **Custom Upload** (PDF dropzone + GitHub repo URL).
   * Animated 6-stage loading overlay during analysis with step indicators.
   * On submit:
     * Curated: Redirects to `/results?paper_id=<id>`.
     * Custom: Submits `multipart/form-data` to `/analyze`, saves response to `sessionStorage.setItem('custom_analysis_result')`, and redirects to `/results?mode=custom`.

3. **`/results` (Audit Dashboard)**:
   * Reads query parameters (`paper_id` or `mode=custom`).
   * Displays:
     * **Top Banner**: Paper title, repo URL link, and PDF Download button.
     * **View Switcher Tabs**:
       1. `📊 Structured Report`: Main view with Score Card, Claim Match Cards, Execution Verdict & Multi-Seed Stats, Discrepancies & Remediation actions, and Dependency Matrix.
       2. `🕸️ Visual Traceability Map`: Interactive bipartite graph (`TraceabilityGraph.tsx`) drawing animated bezier curves between claims and files.
       3. `💡 Simple Analysis`: Plain-language summary (`SimpleAnalysis.tsx`) with technical term glossaries and high-level takeaways.
     * **PDF Exporter**: Button triggers client-side PDF synthesis via `pdfGenerator.ts`.

---

## 8. Development & Execution Instructions

### Prerequisites
* **Node.js**: v18+ (tested on Node v24)
* **Python**: 3.10+ (tested on Python 3.14)
* **Git**: Installed and available in PATH (the backend also auto-detects `AppData\Local\Programs\Git\cmd` on Windows)

### Starting the Servers Locally

**Backend (Terminal 1)**:
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
* API runs at: `http://localhost:8000`
* Swagger docs: `http://localhost:8000/docs`
* Health check: `http://localhost:8000/health`

**Frontend (Terminal 2)**:
```bash
cd frontend
npm run dev
```
* Web app runs at: `http://localhost:3000`

---

## 9. Key Architectural Rules for Frontend Enhancements

When making frontend edits, animations, or styling improvements:
1. **Zero Backend Changes Required**: The backend schemas and routes are stable and verified. The frontend can be redesigned, animated, or restructured freely.
2. **Stateless / No Database Needed**: Keep client state passing via `sessionStorage` and query parameters. Do not add Supabase or external DB overhead unless a public leaderboard or user auth is explicitly requested.
3. **Preserve Exact Data Contracts**: Components consuming `AnalyzeResponse`, `Claim`, `Discrepancy`, and `ExecutionResult` should maintain TypeScript type safety.
4. **SVG Dimension Discipline**: All `<svg>` elements should specify explicit numeric `width` and `height` attributes (and/or inline styles) to prevent unstyled visual blowups during hydration.
5. **Color System**:
   * Brand Dark: `#07090e` / `#090d16`
   * Primary Accent: Sky Blue (`#0ea5e9` / Tailwind `sky-500`)
   * Matched/Verified: Emerald Green (`#10b981` / Tailwind `emerald-500`)
   * Partial/Warning: Amber Yellow (`#f59e0b` / Tailwind `amber-500`)
   * Conflicting/Mismatch: Rose Red (`#f43f5e` / Tailwind `rose-500`)
   * Dependency Drift: Purple (`#a855f7` / Tailwind `purple-500`)
