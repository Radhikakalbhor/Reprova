import os
import json
import re
from typing import List, Dict, Any, Optional

PACKAGE_ALIASES = {
    "pytorch": "torch",
    "py-torch": "torch",
    "tf": "tensorflow",
    "pyyaml": "yaml",
}

CORE_ML_FRAMEWORKS = {"torch", "pytorch", "tensorflow", "jax", "python", "transformers", "torchvision", "torchaudio"}


RECOGNIZED_MANIFEST_FILENAMES = {
    "requirements.txt",
    "requirements-dev.txt",
    "requirements_dev.txt",
    "requirements-gpu.txt",
    "requirements_gpu.txt",
    "requirements-cpu.txt",
    "requirements_cpu.txt",
    "requirements.in",
    "environment.yml",
    "environment.yaml",
    "pyproject.toml",
    "poetry.lock",
    "pipfile",
    "pipfile.lock",
    "setup.py",
    "setup.cfg",
    "package.json",
}

EXCLUDED_FILE_PATTERNS = [
    "log",
    "train_log",
    "train_logs",
    "output",
    "result",
    "results",
    "metric",
    "metrics",
    "eval",
    "accuracy",
    "loss",
    "checkpoint",
    "epoch",
    "history",
    "readme",
    "license",
    "authors",
    "citation",
]

PKG_NAME_REGEX = re.compile(r"^[a-zA-Z]([a-zA-Z0-9_\-\.]*[a-zA-Z0-9])?$")
VERSION_REGEX = re.compile(r"^[vV]?[0-9]+(\.[0-9a-zA-Z]+)*(\+[0-9a-zA-Z\.\-]+)?(\.post[0-9]+|\.dev[0-9]+)?$")

NON_PACKAGE_WORDS = {
    "epoch", "loss", "accuracy", "acc", "val", "train", "test", "step",
    "iteration", "batch", "time", "learning_rate", "lr", "total", "error",
    "metric", "metrics", "output", "result", "results", "best", "average",
    "avg", "top1", "top5", "true", "false", "none", "null", "nan"
}


def is_legitimate_dependency_file(file_path: str) -> bool:
    """Validate whether a file is a recognized dependency or configuration manifest."""
    if not file_path:
        return False
    norm_path = file_path.replace("\\", "/").lower()
    fname = os.path.basename(norm_path)

    # Exclude files with excluded substrings (e.g. train_logs.txt, results.txt)
    for excl in EXCLUDED_FILE_PATTERNS:
        if excl in fname or f"/{excl}/" in norm_path or f"/{excl}" in norm_path:
            return False

    # Check exact recognized filenames
    if fname in RECOGNIZED_MANIFEST_FILENAMES:
        return True

    # Check requirements-*.txt or requirements_*.txt
    if (fname.startswith("requirements-") or fname.startswith("requirements_")) and fname.endswith(".txt"):
        return True

    # Check files inside a requirements/ directory ending in .txt
    if ("/requirements/" in norm_path or norm_path.startswith("requirements/")) and fname.endswith(".txt"):
        return True

    return False


def is_valid_package_name(name: str) -> bool:
    """Validate package name according to PEP 508 and blacklist training metric tokens."""
    if not name or len(name) < 2:
        return False
    if not PKG_NAME_REGEX.match(name):
        return False
    clean = normalize_package_name(name)
    if clean in NON_PACKAGE_WORDS:
        return False
    try:
        float(name)
        return False
    except ValueError:
        pass
    return True


def is_valid_version_string(ver: Optional[str]) -> bool:
    """Check if version follows a valid version-like format when declared."""
    if ver is None:
        return True
    ver_clean = ver.strip().strip("'\"")
    if not ver_clean or ver_clean == "*":
        return True
    return bool(VERSION_REGEX.match(ver_clean))


def normalize_package_name(name: str) -> str:
    """Normalize package name to lowercase with hyphens."""
    clean = name.strip().lower().replace("_", "-")
    return PACKAGE_ALIASES.get(clean, clean)


def parse_requirements_content(content: str, source_file: str) -> List[Dict[str, Any]]:
    """Safely parse requirements.txt style content into package entries with strict validation."""
    parsed = []
    for line in content.splitlines():
        line_clean = line.strip()
        if not line_clean or line_clean.startswith("#") or line_clean.startswith("-e") or line_clean.startswith("http"):
            continue

        # Strip inline comments
        if "#" in line_clean:
            line_clean = line_clean.split("#")[0].strip()

        # Match package operator version e.g. torch==2.0.1, torch>=2.0.0, transformers~=4.30.0
        match = re.search(r"^([a-zA-Z][a-zA-Z0-9_\-\.]*[a-zA-Z0-9]|[a-zA-Z])\s*(==|>=|<=|~=|>|<|===|!=)?\s*([0-9a-zA-Z\.\-\*+]+)?", line_clean)
        if match:
            pkg_raw = match.group(1)
            op = match.group(2) or ""
            ver = match.group(3) or None

            if not is_valid_package_name(pkg_raw):
                continue
            if ver and not is_valid_version_string(ver):
                ver = None

            pkg = normalize_package_name(pkg_raw)
            if pkg:
                parsed.append({
                    "package_name": pkg,
                    "declared_version": ver,
                    "version_operator": op,
                    "source_file": source_file,
                    "raw_line": line_clean
                })

    return parsed


def parse_environment_yaml_content(content: str, source_file: str) -> List[Dict[str, Any]]:
    """Safely parse environment.yml / environment.yaml content."""
    parsed = []
    in_pip = False

    for line in content.splitlines():
        line_strip = line.strip()
        if not line_strip or line_strip.startswith("#"):
            continue

        if "pip:" in line_strip:
            in_pip = True
            continue

        # Match yaml list item e.g. - python=3.10, - pytorch=2.1.0, - torchvision==0.16.0
        if line_strip.startswith("-"):
            item = line_strip[1:].strip()
            if item.startswith("pip"):
                continue

            match = re.search(r"^([a-zA-Z][a-zA-Z0-9_\-\.]*[a-zA-Z0-9]|[a-zA-Z])\s*(==|>=|<=|=)?\s*([0-9a-zA-Z\.\-\*+]+)?", item)
            if match:
                pkg_raw = match.group(1)
                op = match.group(2) or ""
                ver = match.group(3) or None
                if not is_valid_package_name(pkg_raw):
                    continue
                if ver and not is_valid_version_string(ver):
                    ver = None
                pkg = normalize_package_name(pkg_raw)
                if pkg:
                    parsed.append({
                        "package_name": pkg,
                        "declared_version": ver,
                        "version_operator": op,
                        "source_file": source_file,
                        "raw_line": item
                    })

    return parsed


def parse_package_json_content(content: str, source_file: str) -> List[Dict[str, Any]]:
    """Safely parse package.json content."""
    parsed = []
    try:
        data = json.loads(content)
        deps = {}
        if isinstance(data.get("dependencies"), dict):
            deps.update(data["dependencies"])
        if isinstance(data.get("devDependencies"), dict):
            deps.update(data["devDependencies"])

        for pkg_raw, val_str in deps.items():
            if isinstance(val_str, str) and is_valid_package_name(pkg_raw):
                match = re.search(r"^(\^|~|==|>=|<=|=)?\s*([0-9a-zA-Z\.\-\*]+)", val_str.strip())
                op = match.group(1) if match else ""
                ver = match.group(2) if match else val_str.strip()
                if ver and not is_valid_version_string(ver):
                    ver = None
                pkg = normalize_package_name(pkg_raw)
                parsed.append({
                    "package_name": pkg,
                    "declared_version": ver,
                    "version_operator": op,
                    "source_file": source_file,
                    "raw_line": f"{pkg_raw}: {val_str}"
                })
    except Exception:
        pass

    return parsed


def parse_pyproject_toml_content(content: str, source_file: str) -> List[Dict[str, Any]]:
    """Safely parse pyproject.toml content using regex."""
    parsed = []
    for line in content.splitlines():
        line_strip = line.strip()
        if not line_strip or line_strip.startswith("#") or line_strip.startswith("["):
            continue

        # e.g. torch = "^2.0.1" or "torch" = ">=2.0.1"
        match = re.search(r'^\s*"?([a-zA-Z][a-zA-Z0-9_\-\.]*[a-zA-Z0-9]|[a-zA-Z])"?\s*=\s*"?(\^|~|==|>=|<=|=)?\s*([0-9a-zA-Z\.\-\*]+)"?', line_strip)
        if match:
            pkg_raw = match.group(1)
            op = match.group(2) or ""
            ver = match.group(3) or None
            if not is_valid_package_name(pkg_raw):
                continue
            if ver and not is_valid_version_string(ver):
                ver = None
            pkg = normalize_package_name(pkg_raw)
            if pkg and pkg not in {"name", "version", "description", "readme", "authors"}:
                parsed.append({
                    "package_name": pkg,
                    "declared_version": ver,
                    "version_operator": op,
                    "source_file": source_file,
                    "raw_line": line_strip
                })

    return parsed


def parse_setup_py_content(content: str, source_file: str) -> List[Dict[str, Any]]:
    """Safely parse setup.py install_requires entries."""
    parsed = []
    m = re.search(r"install_requires\s*=\s*\[(.*?)\]", content, re.DOTALL)
    if m:
        requires_block = m.group(1)
        deps = re.findall(r"['\"]([^'\"]+)['\"]", requires_block)
        for dep in deps:
            parsed.extend(parse_requirements_content(dep, source_file))
    return parsed


def extract_repo_dependencies(files_found: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Extract declared dependency packages from classified files in the repository.
    Strictly restricted to recognized dependency manifests (requirements.txt, environment.yml, pyproject.toml, etc.).
    Returns a dict mapping normalized package_name -> declared info dict.
    """
    declared_map = {}

    for file_obj in files_found:
        fpath = file_obj.get("file_path", "")
        if not is_legitimate_dependency_file(fpath):
            continue

        fname = os.path.basename(fpath).lower()
        excerpt = file_obj.get("excerpt", "")

        parsed_items = []
        if fname in {"requirements.txt", "requirements-dev.txt", "requirements.in"} or fname.startswith("requirements") or "/requirements/" in fpath.replace("\\", "/"):
            parsed_items = parse_requirements_content(excerpt, fpath)
        elif fname in {"environment.yml", "environment.yaml"}:
            parsed_items = parse_environment_yaml_content(excerpt, fpath)
        elif fname == "package.json":
            parsed_items = parse_package_json_content(excerpt, fpath)
        elif fname == "pyproject.toml":
            parsed_items = parse_pyproject_toml_content(excerpt, fpath)
        elif fname in {"setup.py", "setup.cfg"}:
            parsed_items = parse_setup_py_content(excerpt, fpath)

        for item in parsed_items:
            pkg_name = item["package_name"]
            if pkg_name not in declared_map or item.get("declared_version"):
                declared_map[pkg_name] = item

    return declared_map


def run_deterministic_dependency_diff(
    files_found: List[Dict[str, Any]],
    expected_versions_map: Optional[Dict[str, str]] = None,
    installed_versions_map: Optional[Dict[str, str]] = None,
    is_custom: bool = False
) -> Dict[str, Any]:
    """
    Perform deterministic dependency version diff between expected, declared, and installed versions.
    Returns structured dependency evidence items and factual discrepancies if drift is verified.
    """
    declared_map = extract_repo_dependencies(files_found)
    expected_map = expected_versions_map or {}
    installed_map = installed_versions_map or {}

    all_packages = set(declared_map.keys()).union(set(expected_map.keys()))

    evidence_list = []
    drift_discrepancies = []

    for pkg in sorted(all_packages):
        decl_info = declared_map.get(pkg, {})
        declared_ver = decl_info.get("declared_version")
        src_file = decl_info.get("source_file", "Repository codebase")

        expected_ver = expected_map.get(pkg)
        installed_ver = installed_map.get(pkg)

        # Determine Comparison Status
        if expected_ver and declared_ver:
            if declared_ver != expected_ver:
                status = "VERIFIED_DRIFT"
            else:
                status = "MATCHED"
        elif expected_ver and not declared_ver and installed_ver:
            # Manifest does not declare version; container installed version alone does not constitute verified repository drift
            status = "INSUFFICIENT_EVIDENCE"
        elif not expected_ver and declared_ver:
            status = "EXPECTED_VERSION_UNKNOWN"
        elif expected_ver and not declared_ver:
            status = "DECLARED_VERSION_UNKNOWN"
        else:
            status = "MATCHED"

        if is_custom and installed_ver is None:
            inst_display = None
        else:
            inst_display = installed_ver

        evidence_obj = {
            "package_name": pkg,
            "expected_version": expected_ver,
            "declared_version": declared_ver,
            "installed_version": inst_display,
            "source_file": src_file,
            "comparison_status": status,
            "evidence_type": "deterministic_code_parse"
        }
        evidence_list.append(evidence_obj)

        # Factual Discrepancy Generation for VERIFIED_DRIFT
        if status == "VERIFIED_DRIFT":
            target_ver = declared_ver or installed_ver
            severity = "high" if pkg in CORE_ML_FRAMEWORKS else "medium"
            desc = f"Dependency version drift detected for '{pkg}': Expected {expected_ver}, but repository specifies {target_ver} in {src_file}."
            disc_id = f"disc-dep-{pkg}"

            drift_discrepancies.append({
                "id": disc_id,
                "severity": severity,
                "description": desc,
                "location": src_file,
                "root_cause": "dependency_version_drift",
                "root_cause_explanation": f"Factual dependency comparison confirmed version drift between paper expected ({expected_ver}) and repository declared ({target_ver}) in {src_file}.",
                "fix_suggestion": f"Recommended fix: Pin '{pkg}' to version {expected_ver} in {src_file} to align with the paper specification.",
                "dependency_evidence": evidence_obj
            })

    manifest_found = bool(declared_map)
    manifest_status = (
        f"{len(declared_map)} verified package(s) found in dependency manifests."
        if manifest_found
        else "No verified dependency manifest found."
    )

    return {
        "dependency_evidence_list": evidence_list,
        "drift_discrepancies": drift_discrepancies,
        "manifest_found": manifest_found,
        "manifest_status": manifest_status
    }

