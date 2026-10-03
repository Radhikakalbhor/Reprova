import os
import shutil
import tempfile
import subprocess
import re
import io
import urllib.request
import urllib.error
import socket
import zipfile
from typing import List, Dict, Any, Optional

from .rag.chunkers import CodeChunker, Chunk
from .rag.embeddings import get_embedding_engine
from .rag.vector_store import ReprovaVectorStore

MAX_FILES_LIMIT = 500
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
IGNORED_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__", ".idea", ".vscode", "build", "dist", "data", "dataset", "datasets", "sim_data"}
BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".tar", ".gz", ".pt", ".pth", ".bin", ".onnx", ".so", ".dylib", ".dll", ".exe"}


def _is_binary_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in BINARY_EXTENSIONS


def _extract_excerpt(file_path: str, category: str) -> str:
    """Extract hyperparameter and configuration-looking lines from a classified file."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception as e:
        return f"Error reading file: {str(e)}"

    excerpt_lines = []

    if category == "readme":
        content = "".join(lines)
        return content[:500].strip()

    # Pattern matching for hyperparameter/config/argparse lines
    patterns = [
        r"\b(learning_rate|lr|batch_size|epochs|optimizer|weight_decay|momentum|dropout|hidden_dim|num_layers|seed)\b",
        r"\badd_argument\b",
        r"^\s*[\w\.\-]+:\s*[\w\.\-]+",  # YAML key: value
        r"^\s*[\w\.\-]+\s*=\s*[\w\.\-]+",  # Python var = val
    ]

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("//"):
            continue

        for p in patterns:
            if re.search(p, stripped, re.IGNORECASE):
                excerpt_lines.append(stripped)
                break

        if len(excerpt_lines) >= 15:
            break

    if not excerpt_lines:
        # Fallback: take first 10 non-empty lines
        for line in lines:
            stripped = line.strip()
            if stripped:
                excerpt_lines.append(stripped)
            if len(excerpt_lines) >= 10:
                break

    return "\n".join(excerpt_lines[:15])


def _classify_file(rel_path: str, full_path: str) -> str:
    """Classify file into 'readme', 'config', 'training_script', or 'model_definition'."""
    filename = os.path.basename(rel_path).lower()
    ext = os.path.splitext(filename)[1].lower()

    # README
    if filename.startswith("readme"):
        return "readme"

    # Config files
    if ext in {".yaml", ".yml", ".json", ".cfg", ".ini", ".toml"} or "config" in filename or "hparam" in filename:
        return "config"

    # Training scripts
    if filename in {"train.py", "main.py", "run.py", "train_reproducible.ipynb"} or "train" in filename:
        return "training_script"

    # Read content preview to check definitions if python file
    content_preview = ""
    if ext in {".py", ".ipynb"}:
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content_preview = f.read(4000)
        except Exception:
            pass

        if "class " in content_preview and any(nn in content_preview for nn in ["nn.Module", "torch.nn", "tf.keras", "Module"]):
            return "model_definition"
        if "model" in filename or "architecture" in filename or "net.py" in filename:
            return "model_definition"
        if any(term in content_preview for term in ["def train", "for epoch in", "DataLoader", "optimizer.step()"]):
            return "training_script"

    return ""


def _parse_github_repo(repo_url: str) -> Optional[tuple]:
    """Parse (owner, repo) from a GitHub repository URL."""
    if not repo_url:
        return None
    url = repo_url.strip()
    if url.startswith("git@github.com:"):
        url = url.replace("git@github.com:", "https://github.com/")
    m = re.match(r"^https?://(?:www\.)?github\.com/([^/]+)/([^/#?]+)", url, re.IGNORECASE)
    if not m:
        return None
    owner = m.group(1).strip()
    repo = m.group(2).strip()
    if repo.endswith(".git"):
        repo = repo[:-4]
    return (owner, repo) if owner and repo else None


def _download_github_zip(owner: str, repo: str, target_dir: str, timeout: int = 30) -> None:
    """
    Download repository archive from GitHub as a ZIP and extract into target_dir.
    Strips top-level archive directory so target_dir contains the repository root files directly.
    """
    archive_url = f"https://github.com/{owner}/{repo}/archive/HEAD.zip"
    headers = {
        "User-Agent": "Reprova-Paper-Reproducibility/1.0 (https://reprova.dev)"
    }
    req = urllib.request.Request(archive_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise RuntimeError(f"Repository '{owner}/{repo}' not found on GitHub (404). Please verify the URL.")
        raise RuntimeError(f"GitHub returned HTTP {e.code} while downloading repository archive for '{owner}/{repo}'.")
    except urllib.error.URLError as e:
        if isinstance(e.reason, socket.timeout):
            raise RuntimeError(f"Download timed out while fetching repository '{owner}/{repo}' from GitHub.")
        raise RuntimeError(f"Failed to access repository '{owner}/{repo}': {e.reason}")
    except (socket.timeout, TimeoutError):
        raise RuntimeError(f"Download timed out while fetching repository '{owner}/{repo}' from GitHub.")
    except Exception as e:
        raise RuntimeError(f"Failed to download repository '{owner}/{repo}': {str(e)}")

    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            namelist = zf.namelist()
            if not namelist:
                raise RuntimeError(f"Downloaded repository archive for '{owner}/{repo}' is empty.")

            parts = [n.split("/")[0] for n in namelist if "/" in n]
            prefix = parts[0] + "/" if parts and all(n.startswith(parts[0] + "/") for n in namelist if n != parts[0]) else ""

            target_abs = os.path.abspath(target_dir)
            for member in zf.infolist():
                rel_path = member.filename[len(prefix):] if prefix and member.filename.startswith(prefix) else member.filename
                if not rel_path or rel_path.endswith("/"):
                    continue

                # Path traversal safety check
                dest_path = os.path.abspath(os.path.join(target_dir, rel_path))
                if not dest_path.startswith(target_abs):
                    continue

                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                with zf.open(member) as src_file, open(dest_path, "wb") as dst_file:
                    shutil.copyfileobj(src_file, dst_file)
    except zipfile.BadZipFile:
        raise RuntimeError(f"Downloaded file for '{owner}/{repo}' is not a valid ZIP archive.")
    except Exception as e:
        if isinstance(e, RuntimeError):
            raise
        raise RuntimeError(f"Failed to extract repository archive for '{owner}/{repo}': {str(e)}")


def analyze_repo(
    repo_url: str,
    vector_store: Optional[ReprovaVectorStore] = None,
    code_collection: str = "code_chunks",
    profiler: Any = None
) -> dict:
    """
    1. Clone GitHub repository with depth 1, or download via HTTPS ZIP archive if git is unavailable.
    2. Walk file tree within safety caps (MAX_FILES_LIMIT=500, MAX_SIZE_BYTES=50MB).
    3. Structural AST and line-window chunking across code and config files (.py, .yaml, .json, .toml, .sh, .md, Dockerfile).
    4. Dense vector embedding and indexing in in-memory Qdrant code collection.
    5. Maintain backward compatibility with classified files_found and excerpt summaries.
    """
    if not repo_url or not repo_url.strip():
        return {
            "repo_url": repo_url or "",
            "files_found": [],
            "readme_summary": "",
            "warnings": ["No repository URL provided."],
            "error": "missing_repo_url",
            "code_chunks": [],
            "total_code_chunks": 0
        }

    temp_dir = tempfile.mkdtemp(prefix="repo_clone_")
    warnings = []
    files_found = []
    readme_summary = ""
    code_chunks: List[Chunk] = []
    chunker = CodeChunker()

    try:
        # Acquire repository files via git clone if available, or HTTPS ZIP fallback
        cloned = False
        git_executable = shutil.which("git")

        if git_executable:
            if profiler:
                profiler.start_stage("Repository clone", mode="sequential")
            try:
                cmd = ["git", "clone", "--depth", "1", repo_url.strip(), temp_dir]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
                if profiler:
                    profiler.end_stage("Repository clone")
                if res.returncode == 0:
                    cloned = True
                else:
                    err_msg = res.stderr.strip() if res.stderr else "git clone failed"
                    if "not found" in err_msg.lower() or "could not resolve host" in err_msg.lower():
                        user_error = f"Repository '{repo_url}' not found or unreachable. Please verify the URL."
                        return {
                            "repo_url": repo_url,
                            "files_found": [],
                            "readme_summary": "",
                            "warnings": [user_error],
                            "error": user_error,
                            "code_chunks": [],
                            "total_code_chunks": 0
                        }
            except (FileNotFoundError, OSError):
                if profiler:
                    try:
                        profiler.end_stage("Repository clone")
                    except Exception:
                        pass
                cloned = False
            except subprocess.TimeoutExpired:
                if profiler:
                    try:
                        profiler.end_stage("Repository clone")
                    except Exception:
                        pass
                user_error = "Repository clone timed out after 45 seconds."
                return {
                    "repo_url": repo_url,
                    "files_found": [],
                    "readme_summary": "",
                    "warnings": [user_error],
                    "error": user_error,
                    "code_chunks": [],
                    "total_code_chunks": 0
                }

        if not cloned:
            # Fallback: Download via GitHub HTTPS ZIP archive (critical for serverless environments like Vercel)
            parsed = _parse_github_repo(repo_url)
            if not parsed:
                user_error = f"Repository '{repo_url}' could not be accessed. Provide a valid public GitHub repository URL."
                return {
                    "repo_url": repo_url,
                    "files_found": [],
                    "readme_summary": "",
                    "warnings": [user_error],
                    "error": user_error,
                    "code_chunks": [],
                    "total_code_chunks": 0
                }
            owner, repo = parsed
            if profiler:
                profiler.start_stage("Repository download", mode="sequential")
            try:
                _download_github_zip(owner, repo, temp_dir, timeout=30)
                cloned = True
            except RuntimeError as err:
                user_error = str(err)
                return {
                    "repo_url": repo_url,
                    "files_found": [],
                    "readme_summary": "",
                    "warnings": [user_error],
                    "error": user_error,
                    "code_chunks": [],
                    "total_code_chunks": 0
                }
            finally:
                if profiler:
                    try:
                        profiler.end_stage("Repository download")
                    except Exception:
                        pass

        # Walk repo tree
        if profiler:
            profiler.start_stage("Repository indexing", mode="sequential")

        total_files = 0
        total_size = 0
        categories_detected = set()

        for root, dirs, files in os.walk(temp_dir):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

            for file in files:
                total_files += 1
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, temp_dir).replace("\\", "/")

                try:
                    file_size = os.path.getsize(full_path)
                    total_size += file_size
                except Exception:
                    file_size = 0

                # Check safety limits
                if total_files > MAX_FILES_LIMIT or total_size > MAX_SIZE_BYTES:
                    if "Repository exceeds size/file limit; processing capped." not in warnings:
                        warnings.append("Repository exceeds size/file limit; processing capped.")
                    break

                if _is_binary_file(file):
                    continue

                # Generate AST / structural code chunks for this file
                file_chunks = chunker.chunk_file(rel_path, full_path)
                if file_chunks:
                    # For Python files preserve all AST definitions; for large non-code dumps cap at 10 chunks
                    if not rel_path.endswith(".py") and len(file_chunks) > 10:
                        code_chunks.extend(file_chunks[:10])
                    else:
                        code_chunks.extend(file_chunks)

                # Keep legacy category classification for backward compatibility with dependency diff & graph
                category = _classify_file(rel_path, full_path)
                if category:
                    excerpt = _extract_excerpt(full_path, category)
                    if category == "readme" and not readme_summary:
                        readme_summary = excerpt

                    categories_detected.add(category)
                    files_found.append({
                        "file_path": rel_path,
                        "category": category,
                        "excerpt": excerpt
                    })

        # Add warnings for missing standard methodology components
        if "config" not in categories_detected:
            warnings.append("no config file found")
        if "training_script" not in categories_detected:
            warnings.append("no training script found")
        if "model_definition" not in categories_detected:
            warnings.append("no model definition file found")
        if "readme" not in categories_detected:
            warnings.append("repo has no README")

        # Vectorize and index all code chunks into in-memory vector store if provided
        if vector_store is not None and code_chunks:
            embedding_engine = get_embedding_engine()
            chunk_texts = [c.content for c in code_chunks]
            chunk_vectors = embedding_engine.embed_documents(chunk_texts, batch_size=32)
            vector_store.upsert_chunks(
                collection_name=code_collection,
                chunks=code_chunks,
                vectors=chunk_vectors
            )

        if profiler:
            profiler.end_stage("Repository indexing", repo_chunks=len(code_chunks))

        return {
            "repo_url": repo_url,
            "files_found": files_found,
            "readme_summary": readme_summary,
            "warnings": warnings,
            "error": None,
            "code_chunks": code_chunks,
            "total_code_chunks": len(code_chunks)
        }

    except Exception as e:
        return {
            "repo_url": repo_url,
            "files_found": files_found,
            "readme_summary": readme_summary,
            "warnings": warnings + [f"Error during repository analysis: {str(e)}"],
            "error": f"Error during repository analysis: {str(e)}",
            "code_chunks": code_chunks,
            "total_code_chunks": len(code_chunks)
        }

    finally:
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                print(f"Failed to delete temp dir {temp_dir}: {e}")
