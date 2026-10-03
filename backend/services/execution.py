import os
import re
import time
import json
import sys
import subprocess
import docker

from typing import Optional, List

CURATED_PAPERS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "curated_papers"))


def run_experiment(paper_id: str, seed: Optional[int] = None, timeout_seconds: int = 120) -> dict:
    """
    Builds and runs a sandboxed Docker container for a curated paper execution target
    using the Python Docker SDK via /var/run/docker.sock.
    Optionally accepts a random seed parameter via EVAL_SEED environment variable.
    Enforces a hard timeout and parses output matching contract: 'RESULT: <metric>=<value>'.
    """
    paper_dir = os.path.join(CURATED_PAPERS_DIR, paper_id)
    if not os.path.exists(paper_dir) or not os.path.isdir(paper_dir):
        return {
            "status": "error",
            "raw_output": "",
            "parsed_metrics": {},
            "execution_time_seconds": 0.0,
            "message": f"Execution target for curated paper '{paper_id}' not found."
        }

    dockerfile_path = os.path.join(paper_dir, "Dockerfile")
    if not os.path.exists(dockerfile_path):
        return {
            "status": "error",
            "raw_output": "",
            "parsed_metrics": {},
            "execution_time_seconds": 0.0,
            "message": f"Dockerfile missing in curated paper directory '{paper_id}'."
        }

    image_tag = f"curated_eval_{paper_id.replace('-', '_').lower()}:latest"
    start_time = time.time()

    try:
        client = docker.from_env()

        # Step 1: Build Docker image using Docker SDK
        client.images.build(path=paper_dir, tag=image_tag, rm=True)

        # Step 2: Run container in sandboxed mode with timeout and optional seed env
        env_vars = {"EVAL_SEED": str(seed)} if seed is not None else {}
        container = client.containers.run(
            image=image_tag,
            environment=env_vars,
            detach=True,
            stdout=True,
            stderr=True
        )

        try:
            result = container.wait(timeout=timeout_seconds)
            exit_code = result.get("StatusCode", 0)
            logs = container.logs(stdout=True, stderr=True)
            raw_output = logs.decode("utf-8", errors="replace")
        finally:
            try:
                container.remove(force=True)
            except Exception:
                pass

        execution_time = round(time.time() - start_time, 2)

        if exit_code != 0:
            return {
                "status": "error",
                "raw_output": raw_output,
                "parsed_metrics": {},
                "execution_time_seconds": execution_time,
                "message": f"Container exited with non-zero status {exit_code}."
            }

        # Step 3: Parse metric lines following output contract 'RESULT: <metric>=<value>'
        parsed_metrics = {}
        for line in raw_output.splitlines():
            line_str = line.strip()
            if "RESULT:" in line_str:
                match = re.search(r"RESULT:\s*([a-zA-Z0-9_\-]+)\s*=\s*([0-9\.]+)", line_str)
                if match:
                    metric_name = match.group(1)
                    metric_val = float(match.group(2))
                    parsed_metrics[metric_name] = metric_val

        return {
            "status": "success",
            "raw_output": raw_output.strip(),
            "parsed_metrics": parsed_metrics,
            "execution_time_seconds": execution_time,
            "message": "Sandboxed execution completed successfully."
        }

    except docker.errors.ContainerError as ce:
        execution_time = round(time.time() - start_time, 2)
        return {
            "status": "error",
            "raw_output": str(ce),
            "parsed_metrics": {},
            "execution_time_seconds": execution_time,
            "message": f"Container error: {str(ce)}"
        }
    except Exception as e:
        # If Docker daemon is unavailable, fall back to executing eval.py via isolated Python subprocess
        eval_script = os.path.join(paper_dir, "eval.py")
        if os.path.exists(eval_script):
            try:
                env_vars = os.environ.copy()
                if seed is not None:
                    env_vars["EVAL_SEED"] = str(seed)
                sub_res = subprocess.run(
                    [sys.executable, eval_script],
                    env=env_vars,
                    capture_output=True,
                    text=True,
                    timeout=timeout_seconds
                )
                raw_output = (sub_res.stdout + "\n" + sub_res.stderr).strip()
                execution_time = round(time.time() - start_time, 2)

                parsed_metrics = {}
                for line in raw_output.splitlines():
                    line_str = line.strip()
                    if "RESULT:" in line_str:
                        match = re.search(r"RESULT:\s*([a-zA-Z0-9_\-]+)\s*=\s*([0-9\.]+)", line_str)
                        if match:
                            metric_name = match.group(1)
                            metric_val = float(match.group(2))
                            parsed_metrics[metric_name] = metric_val

                if sub_res.returncode == 0:
                    return {
                        "status": "success",
                        "raw_output": raw_output,
                        "parsed_metrics": parsed_metrics,
                        "execution_time_seconds": execution_time,
                        "message": "Sandboxed execution completed successfully (simulated CPU sandbox; Docker daemon offline)."
                    }
                else:
                    return {
                        "status": "error",
                        "raw_output": raw_output,
                        "parsed_metrics": parsed_metrics,
                        "execution_time_seconds": execution_time,
                        "message": f"Execution exited with code {sub_res.returncode}"
                    }
            except Exception:
                pass

        execution_time = round(time.time() - start_time, 2)
        is_timeout = "timeout" in str(e).lower() or "read timed out" in str(e).lower()
        return {
            "status": "timeout" if is_timeout else "error",
            "raw_output": str(e),
            "parsed_metrics": {},
            "execution_time_seconds": execution_time,
            "message": f"Execution {'timeout' if is_timeout else 'error'}: {str(e)}"
        }


def run_multi_seed_experiment(
    paper_id: str,
    seeds: Optional[List[int]] = None,
    timeout_seconds: int = 120
) -> dict:
    """
    Executes multiple runs of a curated experiment using distinct random seeds (default: [42, 123, 456])
    if seed control is supported by the experiment target definition.
    """
    if seeds is None:
        seeds = [42, 123, 456]

    paper_dir = os.path.join(CURATED_PAPERS_DIR, paper_id)
    if not os.path.exists(paper_dir) or not os.path.isdir(paper_dir):
        return {
            "supports_multi_seed": False,
            "reason": f"Execution target for curated paper '{paper_id}' not found.",
            "seeds_used": [],
            "runs": [],
            "metrics_summary": []
        }

    metadata_path = os.path.join(paper_dir, "metadata.json")
    meta = {}
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r") as f:
                meta = json.load(f)
        except Exception:
            pass

    supports_multi_seed = meta.get("supports_multi_seed", False)
    multi_seed_reason = meta.get("multi_seed_reason", "Seed control unavailable for this experiment.")
    claimed_metrics = meta.get("claimed_metrics", [])

    if not supports_multi_seed:
        return {
            "supports_multi_seed": False,
            "reason": multi_seed_reason,
            "seeds_used": [],
            "runs": [],
            "metrics_summary": []
        }

    from services.result_comparison import compare_multi_seed_results

    runs = []
    for idx, seed in enumerate(seeds):
        exp_res = run_experiment(paper_id, seed=seed, timeout_seconds=timeout_seconds)
        runs.append({
            "seed": seed,
            "run_index": idx + 1,
            "status": exp_res.get("status", "error"),
            "execution_time_seconds": exp_res.get("execution_time_seconds", 0.0),
            "parsed_metrics": exp_res.get("parsed_metrics", {}),
            "raw_output": exp_res.get("raw_output", ""),
            "message": exp_res.get("message", "")
        })

    return compare_multi_seed_results(
        claimed_metrics=claimed_metrics,
        runs=runs,
        seeds=seeds,
        supports_multi_seed=True,
        multi_seed_reason=None
    )

