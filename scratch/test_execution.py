import urllib.request
import json

def test_execution_feature():
    print("--- 1. TESTING CURATED PAPER ANALYSIS WITH EXECUTION (paper-llama2) ---")
    payload = json.dumps({"paper_id": "paper-llama2"}).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:8000/analyze",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print("Paper Title:", data.get("paper_title"))
        exec_res = data.get("execution_result")
        print("Execution Result:", json.dumps(exec_res, indent=2))
        
        assert exec_res is not None, "execution_result should not be None"
        assert exec_res.get("status") == "success", f"Expected success, got {exec_res.get('status')}"
        assert exec_res.get("parsed_metrics") == {"top1_accuracy": 0.932}
        
        comp = exec_res.get("comparison", {})
        assert comp.get("overall_verdict") in ("reproduced", "partially_reproduced")
        comparisons = comp.get("comparisons", [])
        assert len(comparisons) > 0
        top1_comp = comparisons[0]
        assert top1_comp.get("metric") == "top1_accuracy"
        assert top1_comp.get("claimed") == 0.945
        assert top1_comp.get("reproduced") == 0.932
        assert top1_comp.get("verdict") == "match"
        print("-> Curated paper analysis execution test PASSED!")

    print("\n--- 2. TESTING DIRECT EXECUTION ENDPOINT (/analyze/paper-llama2/execute) ---")
    req_exec = urllib.request.Request(
        "http://localhost:8000/analyze/paper-llama2/execute",
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req_exec) as resp:
        data = json.loads(resp.read().decode())
        print("Direct Execution Endpoint Response:", json.dumps(data, indent=2))
        assert data.get("status") == "success"
        assert data.get("parsed_metrics") == {"top1_accuracy": 0.932}
        print("-> Direct execution endpoint test PASSED!")

    print("\n--- 3. TESTING CUSTOM PAPER ANALYSIS EXECUTION SKIPPED ---")
    payload_custom = json.dumps({"paper_url": "custom_paper.pdf", "mode": "custom"}).encode("utf-8")
    req_custom = urllib.request.Request(
        "http://localhost:8000/analyze",
        data=payload_custom,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req_custom) as resp:
        data = json.loads(resp.read().decode())
        exec_res = data.get("execution_result")
        print("Custom Execution Result:", exec_res)
        assert exec_res.get("status") == "skipped"
        assert "execution only available for curated papers" in exec_res.get("message", "")
        print("-> Custom paper execution skip test PASSED!")

    print("\nALL EXECUTION PIPELINE TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_execution_feature()
