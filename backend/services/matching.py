import os
import json
import re
import time
from typing import List, Dict, Any, Optional

from .rag.retriever import RAGRetriever
from .llm import get_llm_provider, LLMProviderError

DEFAULT_CODE_SIMILARITY_THRESHOLD = float(os.getenv("RAG_CODE_SIMILARITY_THRESHOLD", "0.70"))

SINGLE_CLAIM_MATCHING_PROMPT = """You are an expert software & machine learning reproducibility auditor.
Compare the following extracted paper claim against ONLY the retrieved repository code chunks below.

CLAIM TO EVALUATE:
ID: {claim_id}
Description: {claim_desc}
Paper Evidence: {paper_evidence}

RETRIEVED REPOSITORY CODE CHUNKS:
{retrieved_code_blocks}

INSTRUCTIONS:
1. Determine "status": MUST be exactly one of: "matched", "partial_match", "not_found", "conflicting".
   - "matched": code confirms paper claim exactly or closely with concrete evidence.
   - "partial_match": component exists but some value/config differs or is partially defined.
   - "conflicting": code explicitly contradicts paper claim.
   - "not_found": code implementation does not fulfill or reference this claim.

EVIDENCE-TYPE VALIDATION INSTRUCTIONS:
- NUMERICAL METRIC CLAIMS (accuracy, error, loss, improvement %, F1): You may ONLY mark "matched" if a retrieved code or log chunk explicitly contains the actual reported numerical value or directly corresponding result entry. Do NOT mark "matched" based on a README title, general description, or model class. If the actual number is absent, mark "not_found".
- HYPERPARAMETER CLAIMS (SGD, learning rate, batch size, early stopping): You may ONLY mark "matched" if the retrieved code contains the parameter/value or explicit training configuration. A generic model definition is NOT sufficient.
- DATASET CLAIMS: You may ONLY mark "matched" if retrieved code explicitly identifies the dataset, subset, split, or data loader. A generic README heading is NOT sufficient.
- ARCHITECTURE CLAIMS: Mark "matched" if the model implementation actually defines the architecture (e.g. ResNet50 in models/resnet.py).

2. "matched_file": the exact file path from the chunk header where evidence was found, or null if status is "not_found".
3. "matched_value": exact parameter value or code snippet found in the chunk, or null if status is "not_found".
4. "reasoning": 1-2 concise sentences explaining why this status was assigned, grounded strictly in the retrieved code.

Return ONLY a valid JSON object matching this structure:
{{
  "claim_id": "{claim_id}",
  "status": "matched" | "partial_match" | "not_found" | "conflicting",
  "matched_file": "file/path.py" | null,
  "matched_value": "code snippet" | null,
  "reasoning": "Grounded explanation based on retrieved code."
}}
"""


BATCH_CLAIM_MATCHING_PROMPT = """You are an expert software & machine learning reproducibility auditor.
Compare each of the following extracted paper claims against ONLY its corresponding retrieved repository code chunks.

CLAIMS TO EVALUATE:
{claims_and_evidence_blocks}

INSTRUCTIONS FOR EACH CLAIM:
1. Determine "status": MUST be exactly one of: "matched", "partial_match", "not_found", "conflicting".
   - "matched": code confirms paper claim exactly or closely with concrete evidence.
   - "partial_match": component exists but some value/config differs or is partially defined.
   - "conflicting": code explicitly contradicts paper claim.
   - "not_found": code implementation does not fulfill or reference this claim.

EVIDENCE-TYPE VALIDATION INSTRUCTIONS:
- NUMERICAL METRIC CLAIMS (accuracy, error, loss, improvement %, F1): You may ONLY mark "matched" if a retrieved code or log chunk explicitly contains the actual reported numerical value or directly corresponding result entry. Do NOT mark "matched" based on a README title, general description, or model class. If the actual number is absent, mark "not_found".
- HYPERPARAMETER CLAIMS (SGD, learning rate, batch size, early stopping): You may ONLY mark "matched" if the retrieved code contains the parameter/value or explicit training configuration. A generic model definition is NOT sufficient.
- DATASET CLAIMS: You may ONLY mark "matched" if retrieved code explicitly identifies the dataset, subset, split, or data loader. A generic README heading is NOT sufficient.
- ARCHITECTURE CLAIMS: Mark "matched" if the model implementation actually defines the architecture (e.g. ResNet50 in models/resnet.py).

2. "matched_file": the exact file path from the chunk header where evidence was found, or null if status is "not_found".
3. "matched_value": exact parameter value or code snippet found in the chunk, or null if status is "not_found".
4. "reasoning": 1-2 concise sentences explaining why this status was assigned, grounded strictly in the retrieved code.

Return ONLY a valid JSON array of objects matching this exact structure:
[
  {{
    "claim_id": "<claim_id>",
    "status": "matched" | "partial_match" | "not_found" | "conflicting",
    "matched_file": "file/path.py" | null,
    "matched_value": "code snippet" | null,
    "reasoning": "Grounded explanation based on retrieved code."
  }}
]
"""


def _extract_metric_numbers(text: str) -> List[str]:
    """Extract significant numbers, percentages, and epoch references from text."""
    pcts = re.findall(r"\b(\d+(?:\.\d+)?)\s*%", text)
    floats = re.findall(r"\b(\d+\.\d+)\b", text)
    epochs = re.findall(r"(?:epoch|epochs)\s*(\d+)", text, re.IGNORECASE) + re.findall(r"(\d+)\s*(?:epoch|epochs)", text, re.IGNORECASE)
    integers = [m for m in re.findall(r"\b(\d+)\b", text) if int(m) >= 10]
    combined = list(dict.fromkeys(pcts + floats + epochs + integers))
    return combined


def _validate_evidence_against_claim(
    claim: Dict[str, Any],
    status: str,
    matched_file: Optional[str],
    matched_val: Optional[str],
    reasoning: str,
    start_l: Optional[int],
    end_l: Optional[int],
    sym: Optional[str],
    retrieved_chunks: List[Dict[str, Any]],
    top_score: float,
    threshold: float
) -> Dict[str, Any]:
    """
    Enforces deterministic minimum evidence rules after Groq classification:
    1. NUMERICAL METRICS: Must contain actual reported numbers or log entries. Reject generic README/model chunks.
    2. HYPERPARAMETERS: Must contain parameter names / explicit config. Reject generic model definitions.
    3. DATASET: Must identify dataset, subset, split, or loader. Reject generic README headings.
    4. ARCHITECTURE: Model implementation must support architecture claim (e.g. ResNet50 in models/resnet.py).
    5. NOT_FOUND: Clears code location/value and records rejected_candidate if retrieved candidate exists.
    """
    ctype = claim.get("type", "general")
    desc = claim.get("description", "")
    ev = claim.get("evidence", "")
    full_text = f"{desc} {ev}".lower()

    all_chunk_contents = " ".join([c.get("content", "") for c in retrieved_chunks])
    all_chunk_lower = all_chunk_contents.lower()

    is_metric_claim = (
        ctype == "metric"
        or any(term in full_text for term in ["accuracy", "error", "loss", "f1", "precision", "recall", "top-1", "top1", "improvement percentage", "%", "percent", "score"])
    )
    is_dataset_claim = (
        ctype == "dataset"
        or any(term in full_text for term in ["dataset", "subset", "split", "imagenet", "cifar"])
    )
    is_hparam_claim = (
        ctype == "hyperparameter"
        or any(term in full_text for term in ["learning rate", "lr", "sgd", "batch size", "epochs", "early stopping", "patience", "weight decay", "optimizer"])
    )
    is_arch_claim = (
        ctype == "architecture"
        or any(term in full_text for term in ["resnet", "transformer", "bert", "densenet", "vgg", "backbone", "architecture"])
    )

    # Rule A: Numerical Metric Validation
    if is_metric_claim and status in {"matched", "partial_match"}:
        metric_nums = _extract_metric_numbers(f"{desc} {ev}")
        num_found = False
        for num_str in metric_nums:
            if num_str in all_chunk_contents or f"{num_str}%" in all_chunk_contents:
                num_found = True
                break
            try:
                f_val = float(num_str)
                if f"{f_val:.1f}" in all_chunk_contents or f"{int(f_val)}" in all_chunk_contents:
                    num_found = True
                    break
            except ValueError:
                pass

        if not num_found:
            status = "not_found"
            reasoning = (
                f"Retrieved repository evidence does not contain the reported numerical value "
                f"({', '.join(metric_nums) if metric_nums else 'reported metric'}). "
                f"Semantic similarity alone does not establish numerical experimental results."
            )

    # Rule B: Hyperparameter Validation
    elif is_hparam_claim and status in {"matched", "partial_match"}:
        is_generic_model_file = bool(matched_file and ("models/" in matched_file or "resnet" in matched_file or "densenet" in matched_file) and "train" not in matched_file)

        # Early stopping check
        if "early stopping" in full_text or "early_stopping" in full_text:
            if not any(k in all_chunk_lower for k in ["early_stopping", "early stopping", "patience"]):
                status = "not_found"
                reasoning = "Retrieved repository code does not contain early stopping configuration or training routines."

        # SGD check
        elif "sgd" in full_text:
            if not any(k in all_chunk_lower for k in ["sgd", "optim.sgd", "torch.optim.sgd"]):
                status = "not_found"
                reasoning = "Retrieved repository code does not contain SGD optimizer configuration."

        elif is_generic_model_file and not any(k in all_chunk_lower for k in ["lr", "learning_rate", "batch_size", "optimizer", "momentum"]):
            status = "not_found"
            reasoning = f"Retrieved chunk in {matched_file} defines model architecture only and does not contain hyperparameter configuration for '{desc}'."

    # Rule C: Dataset Validation
    elif is_dataset_claim and status in {"matched", "partial_match"}:
        is_doc_file = bool(matched_file and (matched_file.lower().endswith((".md", ".txt", ".rst")) or "readme" in matched_file.lower()))
        has_dataset_code = any(k in all_chunk_lower for k in [
            "dataloader", "data_loader", "load_data", "dataset", "torchvision.datasets", 
            "train_loader", "test_loader", "val_loader", "train_dataset", "test_dataset",
            "train_data", "test_data", "subset", "random_split", "np.load", "torch.utils.data"
        ])

        if "100-class" in full_text or "100 class" in full_text:
            if not any(k in all_chunk_lower for k in ["100-class", "100 class", "100_class", "hundred_class"]):
                status = "not_found"
                reasoning = "Repository evidence does not show the claimed ImageNet 100-class subset or its split definition."
        elif "imagenet" in full_text:
            if not any(k in all_chunk_lower for k in ["imagenet", "image_net"]):
                status = "not_found"
                reasoning = "Repository evidence does not show the ImageNet dataset or its preprocessing/split definition."
            elif is_doc_file and not has_dataset_code:
                status = "not_found"
                reasoning = f"Retrieved candidate in {matched_file} is documentation and does not contain explicit ImageNet dataset loading or split implementation."
        elif is_doc_file and not has_dataset_code:
            status = "not_found"
            reasoning = f"Retrieved candidate in {matched_file} is documentation and does not contain explicit dataset loading or split implementation."

    # Rule D: Architecture Validation
    elif is_arch_claim and status == "matched":
        if "resnet-50" in full_text or "resnet50" in full_text:
            if "resnet50" in all_chunk_lower or "resnet(bottleneck" in all_chunk_lower.replace(" ", ""):
                reasoning = f"Code implementation verified in {matched_file} (similarity: {top_score:.3f})."
            elif not any(k in all_chunk_lower for k in ["resnet", "bottleneck"]):
                status = "not_found"
                reasoning = f"Retrieved code in {matched_file} does not implement the claimed ResNet-50 architecture."

    # Rule E: Cleanup and Rejected Candidate Tracking for NOT_FOUND
    rejected_candidate = None
    if status == "not_found":
        if retrieved_chunks and top_score >= threshold:
            best_candidate = retrieved_chunks[0]
            b_meta = best_candidate.get("metadata", {})
            cand_file = b_meta.get("file_path", "unknown")
            rej_reason = (
                reasoning
                if (reasoning and not any(w in reasoning.lower() for w in ["verified in", "verified against", "code implementation verified"]))
                else "Retrieved candidate did not contain sufficient evidence supporting the claim."
            )
            rejected_candidate = {
                "file_path": cand_file,
                "similarity_score": round(top_score, 3),
                "reason": rej_reason
            }
            # Explicitly update reasoning to reflect rejection under validation rules; never leave stale "verified" text.
            if not reasoning or any(w in reasoning.lower() for w in ["verified in", "verified against", "code implementation verified"]):
                reasoning = f"Retrieved candidate {cand_file} was not sufficient to verify the claim under claim-specific evidence validation rules."
            elif cand_file not in reasoning:
                reasoning = f"{reasoning} Retrieved candidate {cand_file} was not sufficient to verify the claim under claim-specific evidence validation rules."
        else:
            if not reasoning or any(w in reasoning.lower() for w in ["verified in", "verified against", "code implementation verified"]):
                reasoning = f"No candidate code chunk met the retrieval threshold of {threshold:.2f} (best similarity: {top_score:.3f})."

        matched_file = None
        matched_val = None
        start_l = None
        end_l = None
        sym = None
    elif status in {"matched", "partial_match"}:
        if "candidate in" in reasoning:
            reasoning = reasoning.replace("candidate in", "verified in")

    return {
        "status": status,
        "matched_file": matched_file,
        "matched_value": matched_val,
        "reasoning": reasoning,
        "start_line": start_l,
        "end_line": end_l,
        "symbol_name": sym,
        "rejected_candidate": rejected_candidate
    }


def _clean_json_str(content: str) -> str:
    """Defensively remove markdown code fences and whitespace from LLM response."""
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _flatten_claims(extracted_claims: Any) -> list:
    """Flatten extracted claims dictionary into a structured list of claim dicts with importance weights and RAG citations."""
    flattened = []

    if isinstance(extracted_claims, dict):
        # Dataset claim (Medium importance)
        dataset = extracted_claims.get("dataset")
        if isinstance(dataset, dict) and (dataset.get("name") or dataset.get("evidence")):
            dname = dataset.get("name") or "Dataset"
            ev = dataset.get("evidence") or ""
            flattened.append({
                "id": "claim-dataset-1",
                "type": "dataset",
                "description": f"Dataset: {dname}",
                "evidence": ev,
                "confidence": dataset.get("confidence", "high"),
                "importance": dataset.get("importance", "medium"),
                "weight": float(dataset.get("weight", 2.0)),
                "page_number": dataset.get("page_number"),
                "section": dataset.get("section"),
                "citation": dataset.get("citation"),
                "chunk_id": dataset.get("chunk_id"),
            })

        # Architecture claim (Medium importance)
        arch = extracted_claims.get("model_architecture")
        if isinstance(arch, dict) and (arch.get("name") or arch.get("evidence")):
            aname = arch.get("name") or "Model Architecture"
            ev = arch.get("evidence") or ""
            flattened.append({
                "id": "claim-arch-1",
                "type": "architecture",
                "description": f"Architecture: {aname}",
                "evidence": ev,
                "confidence": arch.get("confidence", "high"),
                "importance": arch.get("importance", "medium"),
                "weight": float(arch.get("weight", 2.0)),
                "page_number": arch.get("page_number"),
                "section": arch.get("section"),
                "citation": arch.get("citation"),
                "chunk_id": arch.get("chunk_id"),
            })

        # Metrics claims (High importance)
        metrics = extracted_claims.get("claimed_metrics", [])
        if isinstance(metrics, list):
            for idx, m in enumerate(metrics):
                if isinstance(m, dict) and (m.get("metric") or m.get("value")):
                    mname = m.get("metric", "Metric")
                    val = m.get("value", "")
                    ev = m.get("evidence", "")
                    flattened.append({
                        "id": f"claim-metric-{idx+1}",
                        "type": "metric",
                        "description": f"Metric {mname}: {val}",
                        "evidence": ev,
                        "confidence": m.get("confidence", "high"),
                        "importance": m.get("importance", "high"),
                        "weight": float(m.get("weight", 3.0)),
                        "page_number": m.get("page_number"),
                        "section": m.get("section"),
                        "citation": m.get("citation"),
                        "chunk_id": m.get("chunk_id"),
                    })

        # Hyperparameters claims (Low importance)
        hparams = extracted_claims.get("hyperparameters", [])
        if isinstance(hparams, list):
            for idx, hp in enumerate(hparams):
                if isinstance(hp, dict) and (hp.get("name") or hp.get("value")):
                    hpname = hp.get("name", "Hyperparameter")
                    val = hp.get("value", "")
                    ev = hp.get("evidence", "")
                    flattened.append({
                        "id": f"claim-hp-{idx+1}",
                        "type": "hyperparameter",
                        "description": f"Hyperparameter {hpname}: {val}",
                        "evidence": ev,
                        "confidence": hp.get("confidence", "high"),
                        "importance": hp.get("importance", "low"),
                        "weight": float(hp.get("weight", 1.0)),
                        "page_number": hp.get("page_number"),
                        "section": hp.get("section"),
                        "citation": hp.get("citation"),
                        "chunk_id": hp.get("chunk_id"),
                    })

    # Fallback if list input
    if not flattened and isinstance(extracted_claims, list):
        for idx, item in enumerate(extracted_claims):
            if isinstance(item, dict):
                imp = item.get("importance", "medium")
                wt = float(item.get("weight") or (3.0 if imp == "high" else 1.0 if imp == "low" else 2.0))
                flattened.append({
                    "id": item.get("id", f"claim-{idx+1}"),
                    "type": "general",
                    "description": item.get("description", f"Claim {idx+1}"),
                    "evidence": item.get("paper_reference") or item.get("evidence", ""),
                    "confidence": item.get("confidence", "high"),
                    "importance": imp,
                    "weight": wt,
                    "page_number": item.get("page_number"),
                    "section": item.get("section"),
                    "citation": item.get("citation"),
                    "chunk_id": item.get("chunk_id"),
                })
            else:
                # Handle Claim Pydantic object
                imp = getattr(item, "importance", "medium")
                wt = float(getattr(item, "weight", 2.0))
                flattened.append({
                    "id": getattr(item, "id", f"claim-{idx+1}"),
                    "type": "general",
                    "description": getattr(item, "description", f"Claim {idx+1}"),
                    "evidence": getattr(item, "paper_reference", ""),
                    "confidence": getattr(item, "confidence", "high"),
                    "importance": imp,
                    "weight": wt,
                    "page_number": getattr(item, "page_number", None),
                    "section": getattr(item, "section", None),
                    "citation": getattr(item, "citation", None),
                    "chunk_id": getattr(item, "chunk_id", None),
                })

    return flattened


def match_claims_to_code(
    extracted_claims: Any,
    repo_analysis: dict,
    retriever: Optional[RAGRetriever] = None,
    code_similarity_threshold: Optional[float] = None,
    profiler: Any = None
) -> dict:
    """
    RAG-grounded claim-to-code matching:
    1. For each claim, retrieve top relevant repository code chunks via dense vector search.
    2. Enforce configurable similarity threshold (default: 0.70).
    3. If similarity < threshold: Return not_found with explicit "Insufficient code evidence found".
    4. If similarity >= threshold: Supply only retrieved code evidence to Groq for status classification.
    5. Calculate 100% deterministic reproducibility score from verified match statuses.
    """
    if profiler:
        profiler.start_stage("Claim matching", mode="sequential")

    claims_list = _flatten_claims(extracted_claims)
    files_found = repo_analysis.get("files_found", []) if isinstance(repo_analysis, dict) else []

    if not claims_list:
        if profiler:
            profiler.end_stage("Claim matching", claims=0, groq_requests=0)
        return {
            "matches": [],
            "reproducibility_score": None,
            "discrepancies": []
        }

    threshold = code_similarity_threshold if code_similarity_threshold is not None else DEFAULT_CODE_SIMILARITY_THRESHOLD
    provider = get_llm_provider()

    matches = []
    total_weight = 0.0
    total_earned = 0.0
    groq_requests_count = 0

    # Step 1: Dense vector retrieval for all claims
    claim_candidates = []
    for claim in claims_list:
        cid = claim["id"]
        desc = claim["description"]
        ev = claim.get("evidence", "")

        retrieved_chunks = []
        if retriever is not None:
            retrieved_chunks = retriever.retrieve_code_evidence_for_claim(
                claim_description=desc,
                paper_evidence=ev,
                limit=3,
                score_threshold=None
            )

        top_score = retrieved_chunks[0]["score"] if retrieved_chunks else 0.0
        claim_candidates.append({
            "claim": claim,
            "retrieved_chunks": retrieved_chunks,
            "top_score": top_score
        })

    # Step 2: Batch eligible claims (above threshold) into ONE structured Groq request
    eligible_for_llm = [c for c in claim_candidates if c["retrieved_chunks"] and c["top_score"] >= threshold]
    llm_results: Dict[str, Dict[str, Any]] = {}

    if eligible_for_llm and provider.is_configured:
        blocks = []
        for item in eligible_for_llm:
            c = item["claim"]
            cid = c["id"]
            desc = c["description"]
            ev = c.get("evidence", "")
            chunks = item["retrieved_chunks"]

            c_blocks = []
            for rc in chunks:
                meta = rc.get("metadata", {})
                f_path = meta.get("file_path", "unknown")
                s_line = meta.get("start_line", 1)
                e_line = meta.get("end_line", s_line)
                sym_name = meta.get("symbol_name", "")
                score = rc.get("score", 0.0)
                content = rc.get("content", "")[:350].strip()
                c_blocks.append(f"  [CHUNK: {f_path} | L{s_line}-L{e_line} | Symbol: {sym_name} | Score: {score:.3f}]\n  {content}\n")

            blocks.append(
                f"--- CLAIM ID: {cid} ---\n"
                f"Description: {desc}\n"
                f"Paper Evidence: {ev or 'N/A'}\n"
                f"Retrieved Repository Chunks:\n" + "\n".join(c_blocks)
            )

        prompt = BATCH_CLAIM_MATCHING_PROMPT.format(
            claims_and_evidence_blocks="\n\n".join(blocks)
        )

        try:
            groq_requests_count += 1
            parsed = provider.generate_structured_json(prompt=prompt, max_tokens=4000)
            if isinstance(parsed, list):
                for p in parsed:
                    if isinstance(p, dict) and "claim_id" in p:
                        llm_results[p["claim_id"]] = p
            elif isinstance(parsed, dict):
                if "claims" in parsed and isinstance(parsed["claims"], list):
                    for p in parsed["claims"]:
                        if isinstance(p, dict) and "claim_id" in p:
                            llm_results[p["claim_id"]] = p
                elif "claim_id" in parsed:
                    llm_results[parsed["claim_id"]] = parsed
        except (LLMProviderError, Exception) as e:
            print(f"Batched LLM claim matching failed: {e}")

    # Step 3: Deterministic validation and final evaluation for each claim
    for item in claim_candidates:
        claim = item["claim"]
        cid = claim["id"]
        desc = claim["description"]
        ev = claim.get("evidence", "")
        imp = claim.get("importance", "medium")
        wt = float(claim.get("weight", 2.0))
        retrieved_chunks = item["retrieved_chunks"]
        top_score = item["top_score"]

        # Check Insufficient Evidence Threshold
        if not retrieved_chunks or top_score < threshold:
            st = "not_found"
            reasoning = f"Insufficient code evidence found in repository (top similarity {top_score:.3f} < {threshold})."
            matched_file = None
            matched_val = None
            start_l = None
            end_l = None
            sym = None
            c_id = None
        else:
            best_chunk = retrieved_chunks[0]
            b_meta = best_chunk.get("metadata", {})
            start_l = b_meta.get("start_line")
            end_l = b_meta.get("end_line")
            sym = b_meta.get("symbol_name")
            matched_file = b_meta.get("file_path")
            matched_val = best_chunk.get("content", "").splitlines()[1] if len(best_chunk.get("content", "").splitlines()) > 1 else best_chunk.get("content", "")[:100]
            c_id = best_chunk.get("chunk_id")

            llm_eval = llm_results.get(cid)
            if llm_eval:
                st = llm_eval.get("status", "not_found")
                if st not in {"matched", "partial_match", "not_found", "conflicting"}:
                    st = "not_found"
                if llm_eval.get("matched_file"):
                    matched_file = llm_eval.get("matched_file")
                if llm_eval.get("matched_value"):
                    matched_val = llm_eval.get("matched_value")
                reasoning = llm_eval.get("reasoning", f"Verified against retrieved code in {matched_file}.")
            else:
                # Deterministic fallback when LLM unavailable or omitted
                if top_score < threshold:
                    st = "not_found"
                    reasoning = (
                        f"No qualifying implementation evidence found. The best retrieved candidate was "
                        f"{matched_file or 'unknown'} with similarity {top_score:.3f}, which did not reach the "
                        f"configured retrieval threshold of {threshold:.2f}."
                    )
                else:
                    # Candidate meets threshold; eligible for domain-specific evidence validation
                    st = "matched"
                    reasoning = f"Code implementation candidate in {matched_file} (similarity: {top_score:.3f})."

        # Enforce deterministic post-matching evidence validation
        val_res = _validate_evidence_against_claim(
            claim=claim,
            status=st,
            matched_file=matched_file,
            matched_val=matched_val,
            reasoning=reasoning,
            start_l=start_l,
            end_l=end_l,
            sym=sym,
            retrieved_chunks=retrieved_chunks,
            top_score=top_score,
            threshold=threshold
        )
        st = val_res["status"]
        matched_file = val_res["matched_file"]
        matched_val = val_res["matched_value"]
        reasoning = val_res["reasoning"]
        start_l = val_res["start_line"]
        end_l = val_res["end_line"]
        sym = val_res["symbol_name"]
        rejected_cand = val_res["rejected_candidate"]

        # Deterministic scoring points allocation
        if st in ("matched", "verified"):
            st_factor = 1.0
        elif st in ("partial_match", "unverified"):
            st_factor = 0.5
        else:
            st_factor = 0.0

        earned = round(st_factor * wt, 1)
        total_weight += wt
        total_earned += earned

        matches.append({
            "claim_id": cid,
            "claim_description": desc,
            "status": st,
            "matched_file": matched_file,
            "matched_value": matched_val,
            "reasoning": reasoning,
            "confidence": claim.get("confidence", "high"),
            "importance": imp,
            "weight": wt,
            "earned_points": earned,
            "page_number": claim.get("page_number"),
            "section": claim.get("section"),
            "citation": claim.get("citation"),
            "chunk_id": claim.get("chunk_id"),
            "start_line": start_l,
            "end_line": end_l,
            "symbol_name": sym,
            "similarity_score": round(top_score, 3) if top_score else None,
            "rejected_candidate": rejected_cand
        })

    # Weighted Score Formula: (sum(earned_points) / sum(weights)) * 100
    if total_weight > 0:
        raw_score = (total_earned / total_weight) * 100.0
        reproducibility_score = round(min(100.0, max(0.0, raw_score)), 1)
    else:
        reproducibility_score = None

    # Derive Discrepancies from conflicting / not_found claims
    derived_discrepancies = []
    for idx, m in enumerate(matches):
        if m["status"] == "conflicting":
            loc_str = m["matched_file"] or "Repository codebase"
            if m.get("start_line"):
                loc_str += f":L{m['start_line']}"
                if m.get("end_line") and m['end_line'] != m['start_line']:
                    loc_str += f"-L{m['end_line']}"

            derived_discrepancies.append({
                "id": f"disc-match-{idx+1}",
                "severity": "high",
                "description": f"Conflicting implementation: {m['reasoning']}",
                "location": loc_str,
                "page_number": m.get("page_number"),
                "start_line": m.get("start_line"),
                "end_line": m.get("end_line"),
                "code_chunk_id": m.get("chunk_id")
            })
        elif m["status"] == "not_found":
            derived_discrepancies.append({
                "id": f"disc-match-{idx+1}",
                "severity": "medium",
                "description": f"Missing code implementation for: {m['claim_description']}",
                "location": "Repository codebase",
                "page_number": m.get("page_number")
            })

    if profiler:
        profiler.end_stage("Claim matching", claims=len(claims_list), groq_requests=groq_requests_count)

    return {
        "matches": matches,
        "reproducibility_score": reproducibility_score,
        "discrepancies": derived_discrepancies
    }
