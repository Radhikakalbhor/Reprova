import urllib.request
import json

def test_all_curated_papers():
    print("--- 1. TESTING GET /papers ENDPOINT ---")
    req_papers = urllib.request.Request("http://localhost:8000/papers", method="GET")
    with urllib.request.urlopen(req_papers) as resp:
        data = json.loads(resp.read().decode())
        papers = data.get("papers", [])
        print("Curated Papers List:", json.dumps(papers, indent=2))
        assert len(papers) == 3, f"Expected 3 curated papers, got {len(papers)}"
        paper_ids = [p["id"] for p in papers]
        assert "paper-llama2" in paper_ids
        assert "paper-mistral7b" in paper_ids
        assert "paper-clip" in paper_ids
        for p in papers:
            assert p.get("has_execution") is True, f"Execution target missing for {p['id']}"
        print("-> GET /papers test PASSED!")

    print("\n--- 2. TESTING ALL 3 CURATED PAPER EXECUTIONS & COMPARISONS ---")
    results = {}

    for paper_id in ["paper-llama2", "paper-mistral7b", "paper-clip"]:
        print(f"\n[Executing {paper_id}]...")
        payload = json.dumps({"paper_id": paper_id}).encode("utf-8")
        req = urllib.request.Request(
            "http://localhost:8000/analyze",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            exec_res = data.get("execution_result", {})
            comp = exec_res.get("comparison", {})
            print(f"Paper Title: {data.get('paper_title')}")
            print(f"Execution Status: {exec_res.get('status')}")
            print(f"Parsed Metrics: {exec_res.get('parsed_metrics')}")
            print(f"Overall Verdict: {comp.get('overall_verdict')}")
            print(f"Metric Comparisons: {comp.get('comparisons')}")
            
            assert exec_res.get("status") == "success"
            results[paper_id] = {
                "parsed_metrics": exec_res.get("parsed_metrics"),
                "overall_verdict": comp.get("overall_verdict"),
                "verdicts": [c.get("verdict") for c in comp.get("comparisons", [])]
            }

    print("\n--- 3. VERIFYING SENSITIVITY AND DIFFERENCES ACROSS PAPERS ---")
    print("Summary of results across all 3 curated targets:")
    print(json.dumps(results, indent=2))

    # paper-llama2 -> match (top1_accuracy: 0.945 vs 0.932 -> 1.38% diff)
    assert results["paper-llama2"]["overall_verdict"] == "reproduced"
    assert "match" in results["paper-llama2"]["verdicts"]

    # paper-mistral7b -> match (benchmark_score: 0.890 vs 0.892 -> 0.22% diff)
    assert results["paper-mistral7b"]["overall_verdict"] == "reproduced"
    assert "match" in results["paper-mistral7b"]["verdicts"]

    # paper-clip -> mismatch / reproduction_failed (zero_shot_accuracy: 0.740 vs 0.625 -> 15.54% diff)
    assert results["paper-clip"]["overall_verdict"] == "reproduction_failed"
    assert "mismatch" in results["paper-clip"]["verdicts"]

    print("\nALL 3 CURATED PAPER EXECUTION AND COMPARISON TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_all_curated_papers()
