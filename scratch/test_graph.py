import urllib.request
import json

def test_graph_feature():
    print("--- 1. TESTING GET /analyze/paper-llama2/graph ENDPOINT ---")
    req = urllib.request.Request("http://localhost:8000/analyze/paper-llama2/graph", method="GET")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print("Graph Nodes Count:", len(data.get("nodes", [])))
        print("Graph Edges Count:", len(data.get("edges", [])))
        print("Sample Nodes:", json.dumps(data.get("nodes", [])[:3], indent=2))
        print("Sample Edges:", json.dumps(data.get("edges", [])[:3], indent=2))

        assert len(data.get("nodes", [])) > 0, "Graph nodes should not be empty"
        assert len(data.get("edges", [])) > 0, "Graph edges should not be empty"
        claim_nodes = [n for n in data["nodes"] if n.get("type") == "paper_claim"]
        file_nodes = [n for n in data["nodes"] if n.get("type") == "code_file"]
        assert len(claim_nodes) > 0, "Should contain paper_claim nodes"
        assert len(file_nodes) > 0, "Should contain code_file nodes"
        print("-> Direct graph endpoint test PASSED!")

    print("\n--- 2. TESTING GRAPH DATA EMBEDDED IN POST /analyze ---")
    payload = json.dumps({"paper_id": "paper-llama2"}).encode("utf-8")
    req_post = urllib.request.Request(
        "http://localhost:8000/analyze",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req_post) as resp:
        res_json = json.loads(resp.read().decode())
        g_data = res_json.get("graph_data")
        assert g_data is not None, "graph_data should be present in AnalyzeResponse"
        assert "nodes" in g_data and "edges" in g_data
        print(f"-> Embedded graph_data in POST /analyze test PASSED! ({len(g_data['nodes'])} nodes, {len(g_data['edges'])} edges)")

    print("\nALL TRACEABILITY GRAPH TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_graph_feature()
