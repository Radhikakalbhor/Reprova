import os
import ast
import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import fitz  # PyMuPDF


@dataclass
class Chunk:
    chunk_id: str
    source_type: str  # "paper" | "code"
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)


COMMON_SECTION_PATTERNS = [
    r"^(?:\d+\.?\d*\s+)?(?:Abstract|Introduction|Related\s+Work|Background|Methodology|Method|Model\s+Architecture|Architecture|Experiments?|Experimental\s+Setup|Setup|Hyperparameters?|Training\s+Details|Results?|Evaluation|Discussion|Ablation|Conclusion|References|Appendix)(?:\s*[:\-]|\b)",
    r"^\d+\s+[A-Z][A-Za-z0-9\s,\-:]{2,50}$",
    r"^\d+\.\d+\s+[A-Z][A-Za-z0-9\s,\-:]{2,50}$",
]


class PaperChunker:
    """
    Page-aware PDF chunker that preserves 1-indexed page numbers, section headings,
    bounding boxes, and character offsets using PyMuPDF.
    """

    def __init__(
        self,
        target_chunk_chars: int = 1800,
        overlap_chars: int = 350,
        max_pages: int = 150,
        max_chunks: int = 400,
    ):
        self.target_chunk_chars = target_chunk_chars
        self.overlap_chars = overlap_chars
        self.max_pages = max_pages
        self.max_chunks = max_chunks

    def _is_section_heading(self, text: str) -> bool:
        clean = text.strip()
        if len(clean) > 80 or len(clean) < 3:
            return False
        # Do not treat regular sentences ending with period as headings
        if clean.endswith(".") and not re.match(r"^\d+\.", clean):
            return False
        for pat in COMMON_SECTION_PATTERNS:
            if re.search(pat, clean, re.IGNORECASE):
                return True
        return False

    def chunk_pdf(self, pdf_path: str) -> List[Chunk]:
        """
        Extract page-aware chunks from a research paper PDF.
        """
        if not os.path.exists(pdf_path):
            return []

        chunks: List[Chunk] = []
        current_section = "Abstract / Introduction"

        try:
            doc = fitz.open(pdf_path)
            total_pages = min(len(doc), self.max_pages)
            char_offset = 0

            for page_idx in range(total_pages):
                page = doc[page_idx]
                page_num = page_idx + 1  # 1-indexed page number

                blocks = page.get_text("blocks")
                # Block format: (x0, y0, x1, y1, text, block_no, block_type)
                # block_type 0 = text, 1 = image

                page_text_segments = []
                page_bboxes = []

                for b in blocks:
                    if b[6] != 0:
                        continue  # Skip image blocks
                    block_text = b[4].strip()
                    if not block_text:
                        continue

                    # Check for section heading update
                    first_line = block_text.splitlines()[0].strip()
                    if self._is_section_heading(first_line):
                        current_section = first_line[:60]

                    page_text_segments.append(block_text)
                    page_bboxes.append((round(b[0], 1), round(b[1], 1), round(b[2], 1), round(b[3], 1)))

                if not page_text_segments:
                    continue

                full_page_text = "\n\n".join(page_text_segments)
                page_len = len(full_page_text)

                # If page is within target chunk size, make 1 chunk for the page
                if page_len <= self.target_chunk_chars:
                    c_id = f"paper-p{page_num}-c1"
                    bbox = page_bboxes[0] if page_bboxes else None
                    chunks.append(
                        Chunk(
                            chunk_id=c_id,
                            source_type="paper",
                            content=full_page_text,
                            metadata={
                                "chunk_id": c_id,
                                "source_type": "paper",
                                "page_number": page_num,
                                "section": current_section,
                                "char_start": char_offset,
                                "char_end": char_offset + page_len,
                                "bbox": bbox,
                            },
                        )
                    )
                else:
                    # Multi-chunk page with overlapping sliding window
                    step = max(200, self.target_chunk_chars - self.overlap_chars)
                    c_idx = 1
                    for start_idx in range(0, page_len, step):
                        end_idx = min(page_len, start_idx + self.target_chunk_chars)
                        slice_text = full_page_text[start_idx:end_idx].strip()
                        if len(slice_text) < 80 and c_idx > 1:
                            continue  # Skip trailing tiny slivers

                        c_id = f"paper-p{page_num}-c{c_idx}"
                        chunks.append(
                            Chunk(
                                chunk_id=c_id,
                                source_type="paper",
                                content=slice_text,
                                metadata={
                                    "chunk_id": c_id,
                                    "source_type": "paper",
                                    "page_number": page_num,
                                    "section": current_section,
                                    "char_start": char_offset + start_idx,
                                    "char_end": char_offset + end_idx,
                                    "bbox": page_bboxes[0] if page_bboxes else None,
                                },
                            )
                        )
                        c_idx += 1

                        if len(chunks) >= self.max_chunks:
                            break

                char_offset += page_len

                if len(chunks) >= self.max_chunks:
                    break

            doc.close()
        except Exception as e:
            print(f"Error during PDF chunking: {e}")

        return chunks


class CodeChunker:
    """
    Code and configuration chunker that preserves file paths, 1-indexed line numbers,
    symbol names, and language tags. Uses Python AST where possible.
    """

    SUPPORTED_EXTENSIONS = {
        ".py": "python",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".json": "json",
        ".toml": "toml",
        ".sh": "bash",
        ".md": "markdown",
        ".txt": "text",
        "dockerfile": "dockerfile",
    }

    SECRET_KEYWORDS = {"id_rsa", "id_ed25519", "api_key", ".pem", ".key", "secret", "token"}

    def __init__(self, max_chunk_lines: int = 50, overlap_lines: int = 10):
        self.max_chunk_lines = max_chunk_lines
        self.overlap_lines = overlap_lines

    def _is_safe_file(self, rel_path: str) -> bool:
        lower = rel_path.lower()
        if any(sec in lower for sec in self.SECRET_KEYWORDS):
            return False
        base = os.path.basename(lower)
        ext = os.path.splitext(base)[1]
        if base == "dockerfile" or ext in self.SUPPORTED_EXTENSIONS or base in {"requirements.txt", "setup.py"}:
            return True
        return False

    def chunk_python_code(self, file_path: str, content: str) -> List[Chunk]:
        """Chunk Python code using AST to find functions, classes, and top-level configs."""
        lines = content.splitlines()
        chunks: List[Chunk] = []

        try:
            tree = ast.parse(content, filename=file_path)
            claimed_lines = set()

            for node in ast.iter_child_nodes(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    start_line = getattr(node, "lineno", 1)
                    end_line = getattr(node, "end_lineno", start_line)
                    sym_name = f"class {node.name}" if isinstance(node, ast.ClassDef) else f"def {node.name}"

                    # If definition is huge (> 100 lines), sub-chunk it
                    if end_line - start_line > 90:
                        step = self.max_chunk_lines - self.overlap_lines
                        for s in range(start_line, end_line + 1, step):
                            e = min(end_line, s + self.max_chunk_lines - 1)
                            snippet = "\n".join(lines[s - 1 : e])
                            c_id = f"code-{file_path.replace('/', '_').replace('.', '_')}-L{s}-L{e}"
                            chunks.append(
                                Chunk(
                                    chunk_id=c_id,
                                    source_type="code",
                                    content=f"# File: {file_path} (Lines {s}-{e})\n{snippet}",
                                    metadata={
                                        "chunk_id": c_id,
                                        "source_type": "code",
                                        "file_path": file_path,
                                        "start_line": s,
                                        "end_line": e,
                                        "symbol_name": sym_name,
                                        "language": "python",
                                    },
                                )
                            )
                    else:
                        snippet = "\n".join(lines[start_line - 1 : end_line])
                        c_id = f"code-{file_path.replace('/', '_').replace('.', '_')}-L{start_line}-L{end_line}"
                        chunks.append(
                            Chunk(
                                chunk_id=c_id,
                                source_type="code",
                                content=f"# File: {file_path} (Lines {start_line}-{end_line})\n{snippet}",
                                metadata={
                                    "chunk_id": c_id,
                                    "source_type": "code",
                                    "file_path": file_path,
                                    "start_line": start_line,
                                    "end_line": end_line,
                                    "symbol_name": sym_name,
                                    "language": "python",
                                },
                            )
                        )

                    for ln in range(start_line, end_line + 1):
                        claimed_lines.add(ln)

            # Collect unclaimed lines (e.g. top-level imports, config variables, main block)
            unclaimed = [i + 1 for i in range(len(lines)) if (i + 1) not in claimed_lines and lines[i].strip()]
            if unclaimed:
                # Group contiguous runs of unclaimed lines
                run_start = unclaimed[0]
                prev = unclaimed[0]
                for curr in unclaimed[1:]:
                    if curr - prev > 5 or curr - run_start >= self.max_chunk_lines:
                        snippet = "\n".join(lines[run_start - 1 : prev])
                        if snippet.strip():
                            c_id = f"code-{file_path.replace('/', '_').replace('.', '_')}-L{run_start}-L{prev}"
                            chunks.append(
                                Chunk(
                                    chunk_id=c_id,
                                    source_type="code",
                                    content=f"# File: {file_path} (Lines {run_start}-{prev} Top-Level Config)\n{snippet}",
                                    metadata={
                                        "chunk_id": c_id,
                                        "source_type": "code",
                                        "file_path": file_path,
                                        "start_line": run_start,
                                        "end_line": prev,
                                        "symbol_name": "top_level_config",
                                        "language": "python",
                                    },
                                )
                            )
                        run_start = curr
                    prev = curr

                snippet = "\n".join(lines[run_start - 1 : prev])
                if snippet.strip():
                    c_id = f"code-{file_path.replace('/', '_').replace('.', '_')}-L{run_start}-L{prev}"
                    chunks.append(
                        Chunk(
                            chunk_id=c_id,
                            source_type="code",
                            content=f"# File: {file_path} (Lines {run_start}-{prev} Top-Level Config)\n{snippet}",
                            metadata={
                                "chunk_id": c_id,
                                "source_type": "code",
                                "file_path": file_path,
                                "start_line": run_start,
                                "end_line": prev,
                                "symbol_name": "top_level_config",
                                "language": "python",
                            },
                        )
                    )

            if chunks:
                return chunks
        except Exception:
            pass  # Fall through to line-window chunking

        return self.chunk_line_windows(file_path, content, language="python")

    def chunk_line_windows(self, file_path: str, content: str, language: str) -> List[Chunk]:
        """Fallback chunker for configs, YAML, JSON, TOML, Markdown, shell, and unparseable Python."""
        lines = content.splitlines()
        if not lines:
            return []

        chunks: List[Chunk] = []
        total_lines = len(lines)
        step = max(10, self.max_chunk_lines - self.overlap_lines)

        for start in range(1, total_lines + 1, step):
            end = min(total_lines, start + self.max_chunk_lines - 1)
            snippet = "\n".join(lines[start - 1 : end])
            if not snippet.strip():
                continue

            c_id = f"code-{file_path.replace('/', '_').replace('.', '_')}-L{start}-L{end}"
            chunks.append(
                Chunk(
                    chunk_id=c_id,
                    source_type="code",
                    content=f"# File: {file_path} (Lines {start}-{end})\n{snippet}",
                    metadata={
                        "chunk_id": c_id,
                        "source_type": "code",
                        "file_path": file_path,
                        "start_line": start,
                        "end_line": end,
                        "symbol_name": f"{os.path.basename(file_path)}:L{start}-L{end}",
                        "language": language,
                    },
                )
            )

        return chunks

    def chunk_file(self, rel_path: str, full_path: str) -> List[Chunk]:
        """Chunk a single repository file."""
        if not self._is_safe_file(rel_path):
            return []

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(100000)  # Safe cap per file
        except Exception:
            return []

        base = os.path.basename(rel_path).lower()
        ext = os.path.splitext(base)[1].lower()
        lang = self.SUPPORTED_EXTENSIONS.get(ext, self.SUPPORTED_EXTENSIONS.get(base, "text"))

        if lang == "python":
            return self.chunk_python_code(rel_path, content)
        else:
            return self.chunk_line_windows(rel_path, content, language=lang)
