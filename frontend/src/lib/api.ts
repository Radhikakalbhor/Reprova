export interface Claim {
  id: string;
  description: string;
  status: 'verified' | 'unverified' | 'disputed' | 'matched' | 'partial_match' | 'not_found' | 'conflicting' | string;
  paper_reference?: string;
  matched_file?: string;
  matched_value?: string;
  reasoning?: string;
  confidence?: 'high' | 'medium' | 'low' | string;
  importance?: 'high' | 'medium' | 'low' | string;
  weight?: number;
  earned_points?: number;
  // RAG Evidence Metadata
  page_number?: number | null;
  section?: string | null;
  citation?: string | null;
  chunk_id?: string | null;
  start_line?: number | null;
  end_line?: number | null;
  symbol_name?: string | null;
  similarity_score?: number | null;
  rejected_candidate?: {
    file_path: string;
    similarity_score?: number | null;
    reason: string;
  } | null;
}

export interface DependencyEvidence {
  package_name: string;
  expected_version?: string | null;
  declared_version?: string | null;
  installed_version?: string | null;
  source_file?: string | null;
  comparison_status: 'VERIFIED_DRIFT' | 'MATCHED' | 'EXPECTED_VERSION_UNKNOWN' | 'DECLARED_VERSION_UNKNOWN' | 'INSTALLED_VERSION_UNKNOWN' | string;
  evidence_type?: string;
}

export interface Discrepancy {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  description: string;
  location?: string;
  root_cause?: 'missing_hyperparameter' | 'dataset_split_difference' | 'dependency_version_drift' | 'seed_variance' | 'undocumented_default' | 'insufficient_evidence' | string;
  root_cause_explanation?: string;
  fix_suggestion?: string;
  dependency_evidence?: DependencyEvidence;
  page_number?: number | null;
  start_line?: number | null;
  end_line?: number | null;
}

export interface MetricComparisonItem {
  metric: string;
  claimed: number;
  reproduced: number | string | null;
  difference_pct: number | null;
  verdict: 'match' | 'partial' | 'mismatch' | 'missing_in_execution' | string;
}

export interface MetricComparisonSummary {
  comparisons: MetricComparisonItem[];
  overall_verdict: 'reproduced' | 'partially_reproduced' | 'reproduction_failed' | 'no_claimed_metrics' | string;
  summary: string;
}

export interface MultiSeedRun {
  seed: number;
  run_index: number;
  status: string;
  execution_time_seconds?: number | null;
  parsed_metrics?: Record<string, number>;
  raw_output?: string | null;
  message?: string | null;
}

export interface MultiSeedMetricStat {
  metric: string;
  claimed_value: number;
  run_values: number[];
  count: number;
  min_val?: number | null;
  max_val?: number | null;
  mean_val?: number | null;
  range_str?: string | null;
  std_dev?: number | null;
  variance?: number | null;
  interpretation_code: 'reproduced_consistently' | 'reproduced_within_variance' | 'outside_variance' | 'failed_consistently' | 'seed_control_unavailable' | 'insufficient_runs' | string;
  interpretation_summary: string;
  variance_level?: 'low' | 'medium' | 'high' | 'unavailable' | string;
}

export interface MultiSeedExecutionResult {
  supports_multi_seed: boolean;
  reason?: string | null;
  seeds_used?: number[];
  runs?: MultiSeedRun[];
  metrics_summary?: MultiSeedMetricStat[];
}

export interface ExecutionResult {
  status: 'success' | 'timeout' | 'error' | 'skipped' | string;
  raw_output?: string | null;
  parsed_metrics?: Record<string, number | string>;
  execution_time_seconds?: number | null;
  comparison?: MetricComparisonSummary;
  multi_seed_execution?: MultiSeedExecutionResult;
  message?: string;
}

export interface CuratedPaper {
  id: string;
  title: string;
  repo_url: string;
  has_execution: boolean;
}

export interface GraphNode {
  id: string;
  type: 'paper_claim' | 'code_file' | string;
  label: string;
  evidence?: string | null;
  excerpt?: string | null;
  matched_value?: string | null;
  reasoning?: string | null;
  category?: string | null;
  confidence?: 'high' | 'medium' | 'low' | string;
  citation?: string | null;
  file_location?: string | null;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  status: 'matched' | 'partial_match' | 'conflicting' | 'not_found' | string;
  similarity_score?: number | null;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AnalyzeResponse {
  claims: Claim[] | any;
  reproducibility_score: number | null;
  discrepancies: Discrepancy[];
  dependency_diff?: DependencyEvidence[];
  paper_id?: string;
  paper_title?: string;
  repo_url?: string;
  execution_status?: string;
  repository_evidence?: any[];
  repo_analysis?: any;
  execution_result?: ExecutionResult;
  graph_data?: GraphData;
  status?: string;
  reason?: string;
  rag_metadata?: Record<string, any>;
}

export interface AnalyzeParams {
  paper_id?: string;
  paper_url?: string;
  repo_url?: string;
  mode?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchCuratedPapers(): Promise<CuratedPaper[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/papers`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.papers || [];
  } catch {
    return [];
  }
}

export async function analyzePaper(params: AnalyzeParams | FormData): Promise<AnalyzeResponse> {
  let response: Response;
  if (typeof FormData !== 'undefined' && params instanceof FormData) {
    response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      body: params,
    });
  } else {
    response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  }

  if (!response.ok) {
    let errorMsg = `Failed to analyze paper: ${response.statusText || response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.message) {
        errorMsg = errJson.message;
      } else if (errJson && errJson.detail) {
        errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Body not JSON
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function checkBackendHealth(): Promise<{ status: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) return { status: 'offline' };
    return response.json();
  } catch {
    return { status: 'offline' };
  }
}
