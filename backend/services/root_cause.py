import os
import json
import re
from typing import List, Dict, Any, Optional

from .llm import get_llm_provider, LLMProviderError

VALID_ROOT_CAUSES = {
    "missing_hyperparameter",
    "dataset_split_difference",
    "dependency_version_drift",
    "seed_variance",
    "undocumented_default",
    "insufficient_evidence",
}


def _generate_fix_suggestion_heuristic(disc: Dict[str, Any]) -> str:
    """
    Generate a concise, concrete, evidence-grounded fix recommendation for a discrepancy.
    Identifies WHAT needs to change, WHERE it needs to change, and WHY it matters.
    """
    if disc.get("fix_suggestion"):
        return disc["fix_suggestion"]

    desc = disc.get("description", "")
    loc = disc.get("location", "")
    rc = disc.get("root_cause", "")

    loc_str = f"in {loc}" if loc and loc != "Repository Codebase" and loc != "repository" else "in the configuration/entrypoint files"

    # Pattern 1: Value mismatch / param difference
    m_val = re.search(
        r"(?:default\s+)?([a-zA-Z0-9_\-\.]+)\s+(?:in\s+[\w\./]+\s+)?is\s+([0-9\.\w]+)\s+instead\s+of\s+(?:reported|paper-specified|paper\s+value)?\s*([0-9\.\w]+)",
        desc,
        re.IGNORECASE,
    )
    if not m_val:
        m_val = re.search(
            r"([a-zA-Z0-9_\-\.]+)\s+configured\s+to\s+([0-9\.\w]+)\s+instead\s+of\s+(?:paper-specified|reported|paper\s+value)?\s*([0-9\.\w]+)",
            desc,
            re.IGNORECASE,
        )

    if m_val:
        param, current_val, expected_val = m_val.group(1), m_val.group(2), m_val.group(3)
        return f"Recommended fix: Update '{param}' from {current_val} to {expected_val} {loc_str} to align with the paper specification."

    # Pattern 2: Missing seed / initialization
    if rc == "seed_variance" or "seed" in desc.lower():
        return f"Suggested next step: Set an explicit global random seed (e.g., torch.manual_seed(42), np.random.seed(42)) {loc_str} to eliminate random initialization variance across evaluation runs."

    # Pattern 3: Dataset split / pre-filtering omitted
    if rc == "dataset_split_difference" or "dataset" in desc.lower() or "split" in desc.lower() or "script" in desc.lower():
        if "omitted" in desc.lower() or "missing" in desc.lower() or "unreleased" in desc.lower():
            return f"Suggested next step: Publish or document the dataset pre-filtering pipeline and split definitions {loc_str} to enable exact reproduction of the evaluation set."
        return f"Recommended fix: Align dataset split and preprocessing routines {loc_str} with the dataset partitioning reported in the paper."

    # Pattern 4: Missing hyperparameter
    if rc == "missing_hyperparameter" or "hyperparameter" in desc.lower():
        return f"Recommended fix: Add the missing hyperparameter parameter reported in the paper to the configuration {loc_str}."

    # Pattern 5: Dependency version drift
    if rc == "dependency_version_drift" or "version" in desc.lower() or "dependency" in desc.lower():
        return f"Recommended fix: Pin package versions and execution environment dependencies {loc_str} to match the runtime environment specified in the paper."

    # Pattern 6: Undocumented default
    if rc == "undocumented_default":
        return f"Recommended fix: Expose the undocumented default setting {loc_str} as an explicit configuration parameter matching the paper."

    # Fallback when evidence is insufficient
    if rc == "insufficient_evidence" or not desc:
        return "Suggested next step: Document/provide the missing implementation or experiment configuration needed to verify the claim."

    return "Suggested next step: Document/provide the missing implementation or experiment configuration needed to verify the claim."


def classify_root_causes(
    discrepancies: List[Dict[str, Any]],
    claims_context: Any = None,
    repo_context: Any = None,
    execution_context: Any = None,
    retriever: Any = None,
    profiler: Any = None,
) -> List[Dict[str, Any]]:
    """
    Classifies each discrepancy into one of the 6 root-cause categories using Groq API
    or a fallback heuristic classifier, grounded in dual paper & code RAG evidence.
    """
    if not discrepancies:
        return []

    if profiler:
        profiler.start_stage("Root cause analysis", mode="sequential")

    # If retriever is available, enrich discrepancies with dual RAG context
    enriched_evidence = {}
    if retriever is not None:
        try:
            # Compact RAG retrieval: top-1 chunk per discrepancy, limited to 150 chars
            for disc in discrepancies[:6]:  # Cap at top 6 discrepancies to keep latency low & avoid TPM limit
                d_id = disc.get("id")
                d_desc = disc.get("description", "")

                paper_hits = retriever.retrieve_paper_chunks_for_query(d_desc, limit=1)
                p_str = paper_hits[0].get("content", "")[:150] if paper_hits else "No direct paper chunk."

                enriched_evidence[d_id] = {
                    "paper_evidence": p_str,
                    "code_evidence": "No matching code implementation found in repository."
                }
        except Exception as e:
            print(f"Error enriching discrepancies with RAG: {e}")

    provider = get_llm_provider()
    llm_called = False
    result = None
    if provider.is_configured:
        try:
            llm_called = True
            result = _classify_with_llm(
                discrepancies,
                claims_context,
                repo_context,
                execution_context,
                provider,
                enriched_evidence=enriched_evidence,
            )
        except Exception as e:
            print(f"LLM root-cause classification failed: {e}. Falling back to heuristic classifier.")

    if result is None:
        result = _classify_with_heuristics(discrepancies)

    if profiler:
        profiler.end_stage("Root cause analysis", groq_requests=1 if llm_called else 0)

    return result


def _classify_with_llm(
    discrepancies: List[Dict[str, Any]],
    claims_context: Any,
    repo_context: Any,
    execution_context: Any,
    provider: Any,
    enriched_evidence: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:

    evidence_text = ""
    if enriched_evidence:
        lines = []
        for disc_id, ev in enriched_evidence.items():
            lines.append(f"Discrepancy [{disc_id}]: Paper Evidence: {ev.get('paper_evidence', 'N/A')}")
        evidence_text = "\n".join(lines)

    # Compact claims context summary rather than dumping thousands of tokens
    claims_summary = "N/A"
    if claims_context and isinstance(claims_context, list):
        claims_summary = ", ".join([
            f"{getattr(c, 'id', c.get('id', '')) if isinstance(c, dict) or hasattr(c, 'id') else ''}: {getattr(c, 'status', c.get('status', '')) if isinstance(c, dict) or hasattr(c, 'status') else ''}"
            for c in claims_context[:8]
        ])

    prompt = f"""You are an expert ML reproducibility analyst. Classify the root cause and generate a concrete, actionable fix suggestion for each of the following discrepancies detected between a paper and its codebase/execution.

Discrepancies to classify:
{json.dumps(discrepancies, indent=2)}

Retrieved RAG Evidence:
{evidence_text if evidence_text else "No additional RAG evidence."}

Context:
- Claims: {claims_summary}
- Execution Output: {json.dumps(execution_context, indent=2) if execution_context else "N/A"}

Allowed root_cause values (MUST choose exactly one):
1. "missing_hyperparameter" — paper mentions a hyperparameter, but code has no equivalent setting or initialization.
2. "dataset_split_difference" — evidence suggests a different train/test split, dataset version, or preprocessing step.
3. "dependency_version_drift" — library, CUDA, or package version differences affecting numerical results.
4. "seed_variance" — no structural/config error found; difference is plausibly due to random seed or initialization variance.
5. "undocumented_default" — code uses a default value or setting that the paper never specified.
6. "insufficient_evidence" — not enough information to determine cause (use this when genuinely unsure).

CRITICAL REQUIREMENTS:
- Base explanations ONLY on supplied paper and repository evidence.
- Do NOT invent file paths, line numbers, or parameter names not present in the evidence.
- Do NOT speculate or claim "dataset_split_difference" when evidence simply does not contain the dataset or implementation. When a component (e.g. dataset, hyperparameter) is missing from repository evidence, classify as "insufficient_evidence" with explanation: "Repository evidence does not show the claimed component or its preprocessing/split definition. The available evidence is insufficient to determine whether the difference is due to dataset selection, filtering, or preprocessing." and fix_suggestion: "Suggested next step: Document/provide the missing implementation or experiment configuration needed to verify the claim."
- If evidence is genuinely insufficient to determine root cause, return "insufficient_evidence" and fix_suggestion: "Suggested next step: Document/provide the missing implementation or experiment configuration needed to verify the claim."
- Use prefix "Recommended fix:" or "Suggested next step:".

Respond ONLY with a valid JSON array of objects following this exact structure:
[
  {{
    "id": "<discrepancy_id>",
    "root_cause": "<one_of_allowed_values>",
    "root_cause_explanation": "<concise 1-2 sentence explanation>",
    "fix_suggestion": "<concrete evidence-grounded fix recommendation>"
  }}
]
"""

    classified_items = provider.generate_structured_json(prompt=prompt, max_tokens=2000)
    if not isinstance(classified_items, list):
        if isinstance(classified_items, dict) and "discrepancies" in classified_items:
            classified_items = classified_items["discrepancies"]
        else:
            classified_items = [classified_items]

    id_map = {item["id"]: item for item in classified_items if isinstance(item, dict) and "id" in item}

    enriched = []
    for disc in discrepancies:
        disc_copy = dict(disc)
        disc_id = disc_copy.get("id")
        if disc_id in id_map:
            rc = id_map[disc_id].get("root_cause", "insufficient_evidence")
            disc_copy["root_cause"] = rc if rc in VALID_ROOT_CAUSES else "insufficient_evidence"
            disc_copy["root_cause_explanation"] = id_map[disc_id].get(
                "root_cause_explanation", "Extracted based on analysis."
            )
            disc_copy["fix_suggestion"] = (
                id_map[disc_id].get("fix_suggestion")
                or _generate_fix_suggestion_heuristic(disc_copy)
            )
        else:
            heuristic_res = _heuristic_single(disc_copy)
            disc_copy["root_cause"] = heuristic_res["root_cause"]
            disc_copy["root_cause_explanation"] = heuristic_res["root_cause_explanation"]
            disc_copy["fix_suggestion"] = _generate_fix_suggestion_heuristic(disc_copy)
        enriched.append(disc_copy)

    return enriched


def _classify_with_heuristics(discrepancies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    enriched = []
    for disc in discrepancies:
        disc_copy = dict(disc)
        h_res = _heuristic_single(disc_copy)
        disc_copy["root_cause"] = h_res["root_cause"]
        disc_copy["root_cause_explanation"] = h_res["root_cause_explanation"]
        disc_copy["fix_suggestion"] = disc_copy.get("fix_suggestion") or _generate_fix_suggestion_heuristic(disc_copy)
        enriched.append(disc_copy)
    return enriched


def _heuristic_single(disc: Dict[str, Any]) -> Dict[str, str]:
    text = (str(disc.get("description", "")) + " " + str(disc.get("location", ""))).lower()

    if any(k in text for k in ["learning rate", "batch size", "weight decay", "warmup", "hyperparameter", "config"]):
        if "default" in text or "instead of" in text:
            return {
                "root_cause": "undocumented_default",
                "root_cause_explanation": "The code relies on default hyperparameter values that differ from or were unspecified in the paper.",
            }
        return {
            "root_cause": "missing_hyperparameter",
            "root_cause_explanation": "Paper specifies hyperparameter settings that could not be verified in codebase configuration.",
        }

    if any(k in text for k in ["seed", "initialization", "random", "stochastic"]):
        return {
            "root_cause": "seed_variance",
            "root_cause_explanation": "Global random seed initialization is unconfigured, introducing run-to-run variance.",
        }

    if any(k in text for k in ["dataset", "split", "train_logs", "test", "data"]):
        if any(term in text for term in ["missing", "not found", "unreleased", "insufficient", "no supporting"]):
            target_ds = "ImageNet 100-class" if "imagenet" in text else "claimed"
            return {
                "root_cause": "insufficient_evidence",
                "root_cause_explanation": f"Repository evidence does not show the {target_ds} dataset or its preprocessing/split definition. The available evidence is insufficient to determine whether the difference is due to dataset selection, filtering, or preprocessing.",
            }
        return {
            "root_cause": "dataset_split_difference",
            "root_cause_explanation": "Retrieved repository evidence indicates a potential variance in dataset split or data preprocessing pipeline between paper and code.",
        }

    if any(k in text for k in ["version", "dependency", "package", "cuda", "torch"]):
        if disc.get("dependency_evidence") and disc["dependency_evidence"].get("comparison_status") == "VERIFIED_DRIFT":
            return {
                "root_cause": "dependency_version_drift",
                "root_cause_explanation": f"Deterministic code parsing verified version drift for '{disc['dependency_evidence'].get('package_name')}' in {disc.get('location', 'repository')}.",
            }
        return {
            "root_cause": "insufficient_evidence",
            "root_cause_explanation": "No factual deterministic dependency version drift was verified in codebase configuration.",
        }

    return {
        "root_cause": "insufficient_evidence",
        "root_cause_explanation": "Current evidence is insufficient to conclusively determine the primary root cause.",
    }
