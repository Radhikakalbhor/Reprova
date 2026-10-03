from typing import List, Optional, Any, Union, Dict
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    paper_id: Optional[str] = Field(None, description="ID of a pre-selected curated paper")
    paper_url: Optional[str] = Field(None, description="URL or name of paper PDF")
    repo_url: Optional[str] = Field(None, description="GitHub repository URL")


class Claim(BaseModel):
    id: str
    description: str
    status: str = Field(..., description="e.g. verified, unverified, disputed, matched, partial_match, not_found, conflicting")
    paper_reference: Optional[str] = None
    matched_file: Optional[str] = None
    matched_value: Optional[str] = None
    reasoning: Optional[str] = None
    confidence: Optional[str] = Field("high", description="high, medium, or low")
    importance: Optional[str] = Field("medium", description="high, medium, or low")
    weight: Optional[float] = Field(2.0, description="Numerical claim importance weight (3.0=high, 2.0=medium, 1.0=low)")
    earned_points: Optional[float] = Field(None, description="Status factor * weight")
    # Grounded RAG Metadata
    page_number: Optional[int] = Field(None, description="1-indexed paper page number where claim was extracted")
    section: Optional[str] = Field(None, description="Paper section heading where claim was found")
    citation: Optional[str] = Field(None, description="Machine-generated citation string (e.g. 'Page 3, Section 3.2')")
    chunk_id: Optional[str] = Field(None, description="Retrieved paper chunk ID")
    start_line: Optional[int] = Field(None, description="Starting line in repository file")
    end_line: Optional[int] = Field(None, description="Ending line in repository file")
    symbol_name: Optional[str] = Field(None, description="Function/class/symbol name in repository")
    similarity_score: Optional[float] = Field(None, description="Cosine similarity score from code vector retrieval")
    rejected_candidate: Optional[Dict[str, Any]] = Field(None, description="Details of rejected retrieval candidate when claim is not_found")


class ClaimMatch(BaseModel):
    claim_id: str
    claim_description: str
    status: str = Field(..., description="matched, partial_match, not_found, conflicting")
    matched_file: Optional[str] = None
    matched_value: Optional[str] = None
    reasoning: Optional[str] = None
    confidence: Optional[str] = Field("high", description="high, medium, or low")
    importance: Optional[str] = Field("medium", description="high, medium, or low")
    weight: Optional[float] = Field(2.0, description="Numerical claim importance weight (3.0=high, 2.0=medium, 1.0=low)")
    earned_points: Optional[float] = Field(None, description="Status factor * weight")
    # Grounded RAG Metadata
    page_number: Optional[int] = None
    section: Optional[str] = None
    citation: Optional[str] = None
    chunk_id: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    symbol_name: Optional[str] = None
    similarity_score: Optional[float] = None
    rejected_candidate: Optional[Dict[str, Any]] = None


class DependencyEvidence(BaseModel):
    package_name: str
    expected_version: Optional[str] = Field(None, description="Expected version from paper/metadata")
    declared_version: Optional[str] = Field(None, description="Declared version in repository file")
    installed_version: Optional[str] = Field(None, description="Installed version in execution environment")
    source_file: Optional[str] = Field(None, description="Source file in repository, e.g. requirements.txt")
    comparison_status: str = Field(..., description="VERIFIED_DRIFT, MATCHED, EXPECTED_VERSION_UNKNOWN, DECLARED_VERSION_UNKNOWN, INSTALLED_VERSION_UNKNOWN")
    evidence_type: str = Field("deterministic_code_parse", description="Evidence source type")


class Discrepancy(BaseModel):
    id: str
    severity: str = Field(..., description="low, medium, high, critical")
    description: str
    location: Optional[str] = None
    root_cause: Optional[str] = Field(None, description="missing_hyperparameter, dataset_split_difference, dependency_version_drift, seed_variance, undocumented_default, insufficient_evidence")
    root_cause_explanation: Optional[str] = None
    fix_suggestion: Optional[str] = Field(None, description="Concrete evidence-grounded fix recommendation")
    dependency_evidence: Optional[Union[DependencyEvidence, dict]] = Field(None, description="Deterministic dependency diff evidence")
    # Grounded RAG Metadata
    page_number: Optional[int] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    code_chunk_id: Optional[str] = None
    paper_chunk_id: Optional[str] = None


class MatchingResult(BaseModel):
    matches: List[ClaimMatch] = Field(default_factory=list)
    reproducibility_score: Optional[float] = None
    discrepancies: List[Discrepancy] = Field(default_factory=list)


class DatasetInfo(BaseModel):
    name: Optional[str] = None
    source: Optional[str] = None
    evidence: Optional[str] = None
    confidence: Optional[str] = "high"
    page_number: Optional[int] = None
    section: Optional[str] = None
    chunk_id: Optional[str] = None


class Hyperparameter(BaseModel):
    name: str
    value: str
    evidence: str
    confidence: Optional[str] = "high"
    page_number: Optional[int] = None
    section: Optional[str] = None
    chunk_id: Optional[str] = None


class ClaimedMetric(BaseModel):
    metric: str
    value: str
    evidence: str
    confidence: Optional[str] = "high"
    page_number: Optional[int] = None
    section: Optional[str] = None
    chunk_id: Optional[str] = None


class ModelArchitecture(BaseModel):
    name: Optional[str] = None
    evidence: Optional[str] = None
    confidence: Optional[str] = "high"
    page_number: Optional[int] = None
    section: Optional[str] = None
    chunk_id: Optional[str] = None


class ExtractedClaims(BaseModel):
    dataset: Optional[DatasetInfo] = None
    hyperparameters: List[Hyperparameter] = Field(default_factory=list)
    claimed_metrics: List[ClaimedMetric] = Field(default_factory=list)
    model_architecture: Optional[ModelArchitecture] = None
    confidence_notes: Optional[str] = None
    error: Optional[str] = None
    raw_response: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = None
    reason: Optional[str] = None


class RepoFile(BaseModel):
    file_path: str
    category: str
    excerpt: str
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    symbol_name: Optional[str] = None


class RepoAnalysis(BaseModel):
    repo_url: str
    files_found: List[RepoFile] = Field(default_factory=list)
    readme_summary: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    error: Optional[str] = None
    total_code_chunks: Optional[int] = 0


class MultiSeedRun(BaseModel):
    seed: int
    run_index: int
    status: str
    execution_time_seconds: Optional[float] = None
    parsed_metrics: Optional[dict] = Field(default_factory=dict)
    raw_output: Optional[str] = None
    message: Optional[str] = None


class MultiSeedMetricStat(BaseModel):
    metric: str
    claimed_value: float
    run_values: List[float] = Field(default_factory=list)
    count: int
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    mean_val: Optional[float] = None
    range_str: Optional[str] = None
    std_dev: Optional[float] = None
    variance: Optional[float] = None
    interpretation_code: str = Field(..., description="reproduced_consistently, reproduced_within_variance, outside_variance, failed_consistently, seed_control_unavailable, insufficient_runs")
    interpretation_summary: str
    variance_level: Optional[str] = None  # low, medium, high, unavailable


class MultiSeedExecutionResult(BaseModel):
    supports_multi_seed: bool = True
    reason: Optional[str] = None
    seeds_used: List[int] = Field(default_factory=list)
    runs: List[MultiSeedRun] = Field(default_factory=list)
    metrics_summary: List[MultiSeedMetricStat] = Field(default_factory=list)


class ExecutionResult(BaseModel):
    status: str
    raw_output: Optional[str] = None
    parsed_metrics: Optional[dict] = Field(default_factory=dict)
    execution_time_seconds: Optional[float] = None
    comparison: Optional[dict] = Field(default_factory=dict)
    multi_seed_execution: Optional[Union[MultiSeedExecutionResult, dict]] = None
    message: Optional[str] = None


class GraphNode(BaseModel):
    id: str
    type: str = Field(..., description="paper_claim, code_file")
    label: str
    evidence: Optional[str] = None
    excerpt: Optional[str] = None
    matched_value: Optional[str] = None
    reasoning: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[str] = None
    citation: Optional[str] = None
    file_location: Optional[str] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    status: str = Field(..., description="matched, partial_match, conflicting, not_found")
    similarity_score: Optional[float] = None


class GraphData(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    claims: Optional[Union[ExtractedClaims, List[Claim], dict]] = None
    reproducibility_score: Optional[float] = Field(None, ge=0, le=100)
    discrepancies: List[Discrepancy] = Field(default_factory=list)
    dependency_diff: Optional[List[Union[DependencyEvidence, dict]]] = Field(default_factory=list)
    paper_id: Optional[str] = None
    paper_title: Optional[str] = None
    repo_url: Optional[str] = None
    execution_status: Optional[str] = None
    repository_evidence: Optional[List[dict]] = None
    repo_analysis: Optional[RepoAnalysis] = None
    execution_result: Optional[Union[ExecutionResult, dict]] = None
    graph_data: Optional[Union[GraphData, dict]] = None
    status: Optional[str] = None
    reason: Optional[str] = None
    rag_metadata: Optional[dict] = None
