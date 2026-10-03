import time
from typing import Dict, Any, List, Optional

class StageProfile:
    def __init__(self, name: str, mode: str = "sequential"):
        self.name = name
        self.mode = mode  # "sequential" or "concurrent"
        self.start_time: float = 0.0
        self.end_time: float = 0.0
        self.elapsed_ms: float = 0.0
        self.claims_count: int = 0
        self.repo_chunks_count: int = 0
        self.llm_requests_count: int = 0
        self.groq_requests_count: int = 0

    def start(self):
        self.start_time = time.perf_counter()
        return self

    def finish(self, claims: int = 0, repo_chunks: int = 0, groq_requests: int = 0, llm_requests: int = 0):
        self.end_time = time.perf_counter()
        self.elapsed_ms = max(0.0, (self.end_time - self.start_time) * 1000.0)
        if claims:
            self.claims_count = claims
        if repo_chunks:
            self.repo_chunks_count = repo_chunks
        req_cnt = llm_requests or groq_requests
        if req_cnt:
            self.llm_requests_count = req_cnt
            self.groq_requests_count = req_cnt
        return self

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stage": self.name,
            "start_time": round(self.start_time, 4),
            "end_time": round(self.end_time, 4),
            "elapsed_ms": round(self.elapsed_ms, 2),
            "elapsed_s": round(self.elapsed_ms / 1000.0, 2),
            "claims_count": self.claims_count,
            "repo_chunks_count": self.repo_chunks_count,
            "llm_requests_count": self.llm_requests_count,
            "groq_requests_count": self.groq_requests_count,
            "mode": self.mode,
        }


class PipelineProfiler:
    def __init__(self):
        self.stages: Dict[str, StageProfile] = {}
        self.start_time = time.perf_counter()
        self.total_elapsed_ms: float = 0.0

    def start_stage(self, name: str, mode: str = "sequential") -> StageProfile:
        stage = StageProfile(name, mode=mode)
        stage.start()
        self.stages[name] = stage
        return stage

    def end_stage(self, name: str, claims: int = 0, repo_chunks: int = 0, groq_requests: int = 0, llm_requests: int = 0) -> Optional[StageProfile]:
        stage = self.stages.get(name)
        if stage:
            stage.finish(claims=claims, repo_chunks=repo_chunks, groq_requests=groq_requests, llm_requests=llm_requests)
        return stage

    def finish(self) -> Dict[str, Any]:
        self.total_elapsed_ms = (time.perf_counter() - self.start_time) * 1000.0
        data = self.to_dict()
        try:
            with open("/tmp/pipeline_timing_summary.json", "w") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass
        return data

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_elapsed_s": round(self.total_elapsed_ms / 1000.0, 2),
            "total_elapsed_ms": round(self.total_elapsed_ms, 2),
            "stages": [s.to_dict() for s in self.stages.values()]
        }

    def print_summary(self):
        total_s = self.total_elapsed_ms / 1000.0
        
        pdf_s = self.stages.get("PDF extraction", StageProfile("")).elapsed_ms / 1000.0
        paper_idx_s = self.stages.get("Paper indexing", StageProfile("")).elapsed_ms / 1000.0
        repo_clone_s = self.stages.get("Repository clone", StageProfile("")).elapsed_ms / 1000.0
        repo_idx_s = self.stages.get("Repository indexing", StageProfile("")).elapsed_ms / 1000.0
        claim_ext_s = self.stages.get("Claim extraction", StageProfile("")).elapsed_ms / 1000.0
        claim_match_s = self.stages.get("Claim matching", StageProfile("")).elapsed_ms / 1000.0
        root_cause_s = self.stages.get("Root cause analysis", StageProfile("")).elapsed_ms / 1000.0
        
        accounted = pdf_s + paper_idx_s + repo_clone_s + repo_idx_s + claim_ext_s + claim_match_s + root_cause_s
        other_s = max(0.0, total_s - accounted)

        summary = (
            f"\n================ TIMING BREAKDOWN ================\n"
            f"PDF extraction: {pdf_s:.2f}s\n"
            f"Paper indexing: {paper_idx_s:.2f}s\n"
            f"Repository clone: {repo_clone_s:.2f}s\n"
            f"Repository indexing: {repo_idx_s:.2f}s\n"
            f"Claim extraction: {claim_ext_s:.2f}s\n"
            f"Claim matching: {claim_match_s:.2f}s\n"
            f"Root cause analysis: {root_cause_s:.2f}s\n"
            f"Other: {other_s:.2f}s\n"
            f"TOTAL: {total_s:.2f}s\n"
            f"==================================================\n"
        )
        print(summary, flush=True)
        import sys
        sys.stderr.write(summary)
        sys.stderr.flush()
        return summary
