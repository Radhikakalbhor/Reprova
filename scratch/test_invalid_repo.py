import urllib.request
import json
import uuid

def test_invalid_and_valid_repos():
    # Construct test multipart PDF payload
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 55 >>\nstream\nBT /F1 12 Tf 50 700 TD (TESTING CANDIDATE TRAINING) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n319\n%%EOF"

    def send_custom_analysis(repo_url):
        boundary = "----WebKitFormBoundary" + uuid.uuid4().hex
        body = []
        body.append(f"--{boundary}".encode())
        body.append(b'Content-Disposition: form-data; name="file"; filename="TESTING CANDIDATE TRAINING.pdf"')
        body.append(b"Content-Type: application/pdf")
        body.append(b"")
        body.append(pdf_content)

        body.append(f"--{boundary}".encode())
        body.append(b'Content-Disposition: form-data; name="repo_url"')
        body.append(b"")
        body.append(repo_url.encode())

        body.append(f"--{boundary}".encode())
        body.append(b'Content-Disposition: form-data; name="mode"')
        body.append(b"")
        body.append(b"custom")

        body.append(f"--{boundary}--".encode())
        body.append(b"")

        payload = b"\r\n".join(body)

        req = urllib.request.Request(
            "http://localhost:8000/analyze",
            data=payload,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())

    print("--- 1. TESTING NONEXISTENT / INVALID GITHUB REPOSITORY ---")
    invalid_url = "https://github.com/this-repository-does-not-exist-123456"
    res_invalid = send_custom_analysis(invalid_url)
    print("Invalid Repo Response:")
    print(json.dumps(res_invalid, indent=2))

    assert res_invalid.get("execution_status") == "repo_analysis_failed", f"Expected repo_analysis_failed, got {res_invalid.get('execution_status')}"
    assert res_invalid.get("reproducibility_score") is None, "reproducibility_score should be None for failed repo"
    assert res_invalid.get("discrepancies") == [], "discrepancies should be empty list for failed repo"
    assert res_invalid.get("repo_analysis", {}).get("error") is not None, "repo_analysis.error should contain error message"
    print("-> Invalid repository error handling test PASSED!")

    print("\n--- 2. TESTING VALID CUSTOM GITHUB REPOSITORY ---")
    valid_url = "https://github.com/MLI-lab/candidate_training"
    res_valid = send_custom_analysis(valid_url)
    print("Valid Repo Response:")
    print("Paper Title:", res_valid.get("paper_title"))
    print("Execution Status:", res_valid.get("execution_status"))
    print("Score:", res_valid.get("reproducibility_score"))

    assert res_valid.get("execution_status") == "custom_analysis_completed"
    assert res_valid.get("reproducibility_score") == 62.5
    assert res_valid.get("repo_analysis", {}).get("error") is None
    assert len(res_valid.get("repo_analysis", {}).get("files_found", [])) > 0
    print("-> Valid repository custom analysis test PASSED!")

    print("\nALL REPOSITORY VALIDATION TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_invalid_and_valid_repos()
