from typing import List, Dict, Any


def build_graph_data(claims: Any, repo_analysis: Any) -> Dict[str, Any]:
    """
    Transforms claims and repo analysis into a graph-friendly node-edge structure:
    - Nodes: paper_claim nodes (left column) and code_file nodes (right column)
    - Edges: directed connections color-coded by match status
    """
    nodes = []
    edges = []

    claims_list = []
    if isinstance(claims, list):
        claims_list = claims
    elif isinstance(claims, dict):
        for k, v in claims.items():
            if isinstance(v, list):
                claims_list.extend(v)

    files_found = []
    if isinstance(repo_analysis, dict):
        files_found = repo_analysis.get("files_found", [])

    file_node_ids = set()

    # Step 1: Create Code File Nodes from repo analysis
    for f in files_found:
        if not isinstance(f, dict):
            continue
        fpath = f.get("file_path")
        if not fpath:
            continue
        node_id = f"file-{fpath.replace('/', '_').replace('.', '_')}"
        file_node_ids.add(fpath)
        nodes.append({
            "id": node_id,
            "type": "code_file",
            "label": fpath,
            "excerpt": f.get("excerpt", ""),
            "category": f.get("category", "")
        })

    # Step 2: Create Paper Claim Nodes & Edges connecting to File Nodes
    for idx, c in enumerate(claims_list):
        if not isinstance(c, dict):
            # Object conversion
            c_dict = {
                "id": getattr(c, "id", f"claim-{idx+1}"),
                "description": getattr(c, "description", f"Claim {idx+1}"),
                "status": getattr(c, "status", "not_found"),
                "paper_reference": getattr(c, "paper_reference", None),
                "matched_file": getattr(c, "matched_file", None),
                "matched_value": getattr(c, "matched_value", None),
                "reasoning": getattr(c, "reasoning", None),
                "confidence": getattr(c, "confidence", "high"),
            }
        else:
            c_dict = c

        claim_id = c_dict.get("id") or f"claim-{idx+1}"
        desc = c_dict.get("description") or f"Claim {idx+1}"
        status = c_dict.get("status") or "not_found"
        matched_file = c_dict.get("matched_file")

        nodes.append({
            "id": claim_id,
            "type": "paper_claim",
            "label": desc,
            "evidence": c_dict.get("paper_reference"),
            "matched_value": c_dict.get("matched_value"),
            "reasoning": c_dict.get("reasoning"),
            "confidence": c_dict.get("confidence", "high")
        })

        if matched_file:
            target_node_id = f"file-{matched_file.replace('/', '_').replace('.', '_')}"
            # Ensure target file node exists in graph if it wasn't in files_found
            if matched_file not in file_node_ids:
                file_node_ids.add(matched_file)
                nodes.append({
                    "id": target_node_id,
                    "type": "code_file",
                    "label": matched_file,
                    "excerpt": c_dict.get("matched_value") or "",
                    "category": "code"
                })

            edges.append({
                "source": claim_id,
                "target": target_node_id,
                "status": status
            })
        elif files_found:
            # Fallback to connect to top classified file node
            first_fpath = files_found[0].get("file_path", "README.md")
            target_node_id = f"file-{first_fpath.replace('/', '_').replace('.', '_')}"
            edges.append({
                "source": claim_id,
                "target": target_node_id,
                "status": status
            })

    return {
        "nodes": nodes,
        "edges": edges
    }
