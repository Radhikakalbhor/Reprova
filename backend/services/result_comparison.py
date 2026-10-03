from typing import List, Dict, Any


def compare_results(claimed_metrics: List[Dict[str, Any]], executed_metrics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pure deterministic numeric comparison of claimed paper metrics against reproduced execution metrics.
    Tolerances:
      - <= 2% difference: match
      - <= 10% difference: partial
      - > 10% difference: mismatch
    """
    comparisons = []
    
    if not claimed_metrics:
        return {
            "comparisons": [],
            "overall_verdict": "no_claimed_metrics",
            "summary": "No claimed numeric metrics were provided for comparison."
        }

    for item in claimed_metrics:
        metric_name = item.get("metric")
        claimed_val = item.get("claimed_value") or item.get("value")
        
        if metric_name is None or claimed_val is None:
            continue

        try:
            claimed_float = float(claimed_val)
        except (ValueError, TypeError):
            continue

        reproduced_val = executed_metrics.get(metric_name)

        if reproduced_val is None:
            comparisons.append({
                "metric": metric_name,
                "claimed": claimed_float,
                "reproduced": None,
                "difference_pct": None,
                "verdict": "missing_in_execution"
            })
            continue

        try:
            reproduced_float = float(reproduced_val)
        except (ValueError, TypeError):
            comparisons.append({
                "metric": metric_name,
                "claimed": claimed_float,
                "reproduced": str(reproduced_val),
                "difference_pct": None,
                "verdict": "unparseable_executed_value"
            })
            continue

        if claimed_float == 0.0:
            diff_pct = 0.0 if reproduced_float == 0.0 else 100.0
        else:
            diff_pct = abs(claimed_float - reproduced_float) / abs(claimed_float) * 100.0

        diff_pct_rounded = round(diff_pct, 2)

        if diff_pct_rounded <= 2.0:
            verdict = "match"
        elif diff_pct_rounded <= 10.0:
            verdict = "partial"
        else:
            verdict = "mismatch"

        comparisons.append({
            "metric": metric_name,
            "claimed": claimed_float,
            "reproduced": reproduced_float,
            "difference_pct": diff_pct_rounded,
            "verdict": verdict
        })

    # Overall verdict determination
    verdicts = [c["verdict"] for c in comparisons]
    if all(v == "match" for v in verdicts) and verdicts:
        overall = "reproduced"
    elif any(v in ("match", "partial") for v in verdicts):
        overall = "partially_reproduced"
    else:
        overall = "reproduction_failed"

    return {
        "comparisons": comparisons,
        "overall_verdict": overall,
        "summary": f"Evaluated {len(comparisons)} metric(s)."
    }


def compare_multi_seed_results(
    claimed_metrics: List[Dict[str, Any]],
    runs: List[Dict[str, Any]],
    seeds: List[int],
    supports_multi_seed: bool = True,
    multi_seed_reason: str = None
) -> Dict[str, Any]:
    """
    Computes multi-seed statistical aggregation (min, max, mean, range, std_dev, variance)
    and scientific interpretation across distinct execution random seeds.
    """
    import math

    if not supports_multi_seed:
        return {
            "supports_multi_seed": False,
            "reason": multi_seed_reason or "Seed control unavailable for this experiment.",
            "seeds_used": [],
            "runs": [],
            "metrics_summary": []
        }

    metrics_summary = []

    for item in claimed_metrics:
        metric_name = item.get("metric")
        claimed_val = item.get("claimed_value") or item.get("value")
        if not metric_name or claimed_val is None:
            continue

        try:
            claimed_float = float(claimed_val)
        except (ValueError, TypeError):
            continue

        run_values = []
        for r in runs:
            p_metrics = r.get("parsed_metrics", {})
            if r.get("status") == "success" and metric_name in p_metrics:
                try:
                    run_values.append(float(p_metrics[metric_name]))
                except (ValueError, TypeError):
                    pass

        count = len(run_values)
        if count == 0:
            metrics_summary.append({
                "metric": metric_name,
                "claimed_value": claimed_float,
                "run_values": [],
                "count": 0,
                "min_val": None,
                "max_val": None,
                "mean_val": None,
                "range_str": "N/A",
                "std_dev": None,
                "variance": None,
                "interpretation_code": "failed_consistently",
                "interpretation_summary": "All multi-seed execution runs failed or yielded unparseable metrics.",
                "variance_level": "unavailable"
            })
            continue

        min_val = round(min(run_values), 4)
        max_val = round(max(run_values), 4)
        mean_val = round(sum(run_values) / count, 4)
        range_str = f"{min_val} – {max_val}"

        if count >= 2:
            variance_val = sum((x - mean_val) ** 2 for x in run_values) / (count - 1)
            std_dev_val = math.sqrt(variance_val)
            variance = round(variance_val, 6)
            std_dev = round(std_dev_val, 4)
        else:
            variance = 0.0
            std_dev = 0.0

        rel_std_dev = (std_dev / claimed_float * 100.0) if claimed_float != 0 else 0.0
        if rel_std_dev <= 1.0:
            var_level = "low"
        elif rel_std_dev <= 5.0:
            var_level = "medium"
        else:
            var_level = "high"

        mean_diff_pct = abs(claimed_float - mean_val) / abs(claimed_float) * 100.0 if claimed_float != 0 else 0.0

        if count < 2:
            code = "insufficient_runs"
            summary = "Insufficient valid runs to establish statistical variance."
        elif mean_diff_pct <= 2.0 and std_dev <= 0.01:
            code = "reproduced_consistently"
            summary = f"Reproduced consistently across {count} random seeds (mean = {mean_val}, std_dev = {std_dev})."
        elif mean_diff_pct <= 5.0:
            code = "reproduced_within_variance"
            summary = f"Observed mean ({mean_val}) is within natural run-to-run seed variance of paper-claimed value ({claimed_float})."
        else:
            code = "outside_variance"
            summary = f"Observed metric values ({range_str}) demonstrate {var_level} run-to-run seed variance (std_dev = {std_dev}), but consistently remain outside the reported paper value ({claimed_float})."

        metrics_summary.append({
            "metric": metric_name,
            "claimed_value": claimed_float,
            "run_values": run_values,
            "count": count,
            "min_val": min_val,
            "max_val": max_val,
            "mean_val": mean_val,
            "range_str": range_str,
            "std_dev": std_dev,
            "variance": variance,
            "interpretation_code": code,
            "interpretation_summary": summary,
            "variance_level": var_level
        })

    return {
        "supports_multi_seed": True,
        "reason": None,
        "seeds_used": seeds,
        "runs": runs,
        "metrics_summary": metrics_summary
    }

