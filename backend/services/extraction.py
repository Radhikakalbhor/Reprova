import os
import json
import re
import urllib.request
import fitz
from typing import Dict, Any, Optional, List

from .rag.chunkers import PaperChunker, Chunk
from .rag.embeddings import get_embedding_engine
from .rag.vector_store import ReprovaVectorStore
from .rag.retriever import RAGRetriever
from .llm import get_llm_provider, LLMProviderError

PROMPT_TEMPLATE = """You are an expert ML reproducibility auditor.
Analyze the retrieved research paper evidence chunks below and extract all structured experimental methodology claims.

You must identify and extract all distinct experimental claims present in the evidence chunks across these categories:
1. Dataset / subset / split (preserve qualifiers, e.g. 'ImageNet (100-class subset)')
2. Model architecture (e.g. 'ResNet-50')
3. Reported numerical metrics (e.g. top-1 error rate, test accuracy)
4. Baseline comparisons and performance improvements (e.g. candidate vs original clean improvement)
5. Training and evaluation accuracy (e.g. clean subset training accuracy, overall training accuracy)
6. Label noise and data quality settings (e.g. false-label-rate / percentage of wrong labels)
7. Optimizer and training algorithm (e.g. SGD / stochastic gradient descent)
8. Early stopping and epoch configurations (e.g. optimal early stopping at 60 epochs, 30 epochs)
9. Other experimental configurations and settings

CRITICAL RULES:
1. Extract ALL distinct experimental claims supported by the evidence chunks. Target extracting 8 to 12 meaningful claims when supported by the text.
2. Return ONLY one valid top-level JSON object. Do NOT include markdown code fences (no ```json), no preamble, and no postscript text.
3. DO NOT truncate important qualifiers, numbers, percentages, or comparisons.
4. In 'hyperparameters', you MUST extract experimental configurations and training settings mentioned in the text, specifically:
   - Optimizer and training algorithm (e.g. name: 'optimizer', value: 'SGD (stochastic gradient descent) with default PyTorch parameters')
   - Early stopping epoch settings (e.g. name: 'early_stopping_epochs', value: 'optimal early stopping at ~60 epochs for ImageNet, ~30 epochs for CIFAR-10')
   - Label noise and data quality settings (e.g. name: 'label_noise_rate', value: 'approximately 50% wrong labels / false label rate')
   Do NOT omit the optimizer or early stopping settings.
5. In 'claimed_metrics', extract numerical performance metrics, baseline comparisons, accuracy improvements, clean subset training accuracy (e.g. 100%), and overall training accuracy (e.g. 65%).
6. Every claim MUST cite the exact 'chunk_id' (e.g. paper-p6-c3 or paper-p7-c1) and provide a concise single-sentence verbatim quote in 'evidence' (do NOT copy long paragraphs).
7. Do NOT include duplicate claims with identical meaning.
8. All four top-level keys ('dataset', 'model_architecture', 'hyperparameters', 'claimed_metrics') MUST be present in the returned JSON object.
9. Do NOT hallucinate claims not present in the chunks.

EVIDENCE CHUNKS:
{grounded_context}

Return ONLY a valid JSON object matching EXACTLY this structure:
{{
  "dataset": {{
    "name": "dataset name with subset/split qualifiers (e.g. ImageNet (100-class subset))",
    "source": "origin or source if specified (e.g. Flickr keyword search)",
    "evidence": "concise single-sentence verbatim quote",
    "chunk_id": "chunk_id",
    "confidence": "high"
  }},
  "model_architecture": {{
    "name": "model architecture name (e.g. ResNet-50)",
    "evidence": "concise single-sentence verbatim quote",
    "chunk_id": "chunk_id",
    "confidence": "high"
  }},
  "hyperparameters": [
    {{
      "name": "configuration name (e.g. optimizer, early_stopping_epochs, label_noise_rate)",
      "value": "setting or parameter value (e.g. SGD with default PyTorch parameters, optimal early stopping at 60 epochs, 50% false label rate)",
      "evidence": "concise single-sentence verbatim quote",
      "chunk_id": "chunk_id",
      "confidence": "high"
    }}
  ],
  "claimed_metrics": [
    {{
      "metric": "metric name preserving comparison/context (e.g. Top-1 classification error (candidate vs clean), Performance improvement, Training accuracy on clean subset, Overall training accuracy)",
      "value": "reported score, percentage, or comparison (e.g. 10.56% vs 15%, 4.44% improvement, 100%, 65%)",
      "evidence": "concise single-sentence verbatim quote",
      "chunk_id": "chunk_id",
      "confidence": "high"
    }}
  ],
  "confidence_notes": "brief notes on experimental claims found"
}}
"""


def extract_paper_title_from_pdf(pdf_path: str) -> str:
    """Extract actual paper title from PDF text blocks or metadata."""
    try:
        doc = fitz.open(pdf_path)
        meta_title = doc.metadata.get("title", "") if doc.metadata else ""
        if meta_title and len(meta_title.strip()) > 3 and not any(g in meta_title.lower() for g in ["microsoft word", "untitled", "latex", "pdf", "default"]):
            doc.close()
            return meta_title.strip()

        if len(doc) > 0:
            page = doc[0]
            blocks = page.get_text("blocks")
            for b in blocks:
                txt = b[4].strip() if len(b) > 4 else ""
                if txt and len(txt) > 5 and not any(txt.lower().startswith(ign) for ign in ["arxiv", "vol.", "doi", "http", "issn", "page", "conference"]):
                    title_candidate = " ".join(txt.splitlines()[:2]).strip()
                    doc.close()
                    return title_candidate
        doc.close()
    except Exception as e:
        print(f"Error extracting title from {pdf_path}: {e}")

    base = os.path.basename(pdf_path)
    clean_base = os.path.splitext(base)[0].replace("_", " ").replace("-", " ")
    return clean_base.strip() if clean_base.strip() else "Custom Uploaded Paper"


def inspect_github_repo(repo_url: str, files_found: Optional[List[Dict[str, Any]]] = None) -> dict:
    """Inspect repository URL dynamically via local cloned files or GitHub API fallback."""
    clean_url = repo_url.rstrip("/") if repo_url else ""
    parts = clean_url.split("/")
    repo_name = parts[-1] if len(parts) > 0 else "repository"
    org_name = parts[-2] if len(parts) > 1 else ""

    detected_files = []
    status = "repository_inspected"

    if files_found:
        # Extract top-level items from the cloned repository without network overhead
        top_items = set()
        for f in files_found:
            fp = f.get("file_path", "")
            if fp:
                top_items.add(fp.split("/")[0])
        detected_files = sorted(list(top_items))
        status = "repository_inspected_from_clone"
    elif org_name and repo_name:
        api_url = f"https://api.github.com/repos/{org_name}/{repo_name}/contents"
        try:
            req = urllib.request.Request(api_url, headers={"User-Agent": "MLPaperReproducibilityPlatform/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                if isinstance(data, list):
                    detected_files = [item.get("name") for item in data if isinstance(item, dict) and item.get("name")]
                    status = "github_api_contents_fetched"
        except Exception as e:
            print(f"Could not fetch GitHub API for {org_name}/{repo_name}: {e}")
            status = "github_api_fetch_failed"

    if not detected_files:
        detected_files = ["README.md"]

    return {
        "repo_name": repo_name,
        "org_name": org_name,
        "repo_url": repo_url,
        "detected_files": detected_files,
        "status": status
    }


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract raw text from PDF page by page using PyMuPDF (fitz)."""
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            page_text = page.get_text()
            if page_text:
                text += page_text + "\n"
        doc.close()
    except Exception as e:
        print(f"Error reading PDF {pdf_path}: {e}")
        return ""
    return text.strip()


def _clean_json_str(content: str) -> str:
    """Defensively remove markdown code fences and whitespace from response."""
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _attach_verified_metadata(claim_item: Dict[str, Any], chunks_map: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Look up chunk_id in verified chunks map and attach authentic page_number, section, and citation in Python."""
    if not isinstance(claim_item, dict):
        return claim_item

    c_id = claim_item.get("chunk_id")
    chunk_data = chunks_map.get(c_id) if c_id else None

    # If exact chunk_id not matched, search for any chunk containing verbatim evidence
    if not chunk_data and claim_item.get("evidence"):
        ev_lower = claim_item["evidence"][:40].lower()
        for cid, cdata in chunks_map.items():
            if ev_lower in cdata.get("content", "").lower():
                chunk_data = cdata
                c_id = cid
                break

    if chunk_data:
        meta = chunk_data.get("metadata", {})
        page_num = meta.get("page_number")
        section = meta.get("section")
        claim_item["page_number"] = page_num
        claim_item["section"] = section
        claim_item["chunk_id"] = c_id

        parts = []
        if page_num:
            parts.append(f"Page {page_num}")
        if section:
            parts.append(f"Section: {section}")
        claim_item["citation"] = ", ".join(parts) if parts else None
    else:
        claim_item["page_number"] = None
        claim_item["section"] = None
        claim_item["citation"] = None

    return claim_item


def extract_claims_from_pdf(
    pdf_path: str,
    vector_store: Optional[ReprovaVectorStore] = None,
    paper_collection: str = "paper_chunks",
    profiler: Any = None
) -> dict:
    """
    RAG-grounded methodology claim extraction pipeline:
    1. Page-aware PDF chunking via PyMuPDF (preserving page_number, section, bboxes).
    2. Dense embedding generation via FastEmbed BAAI/bge-small-en-v1.5.
    3. In-memory Qdrant indexing.
    4. Topic-grounded retrieval for dataset, hyperparameters, metrics, and architecture.
    5. Groq structured extraction constrained strictly to retrieved chunks.
    6. Python-verified citation and page metadata attachment.
    """
    if profiler:
        profiler.start_stage("PDF extraction", mode="sequential")

    chunker = PaperChunker()
    paper_chunks: List[Chunk] = chunker.chunk_pdf(pdf_path)

    if profiler:
        profiler.end_stage("PDF extraction")

    if not paper_chunks:
        return {
            "error": "no_extractable_text",
            "message": "Unable to extract selectable text from this PDF."
        }

    # Embed and index paper chunks into vector store
    if profiler:
        profiler.start_stage("Paper indexing", mode="sequential")

    embedding_engine = get_embedding_engine()
    if vector_store is not None:
        chunk_texts = [c.content for c in paper_chunks]
        chunk_vectors = embedding_engine.embed_documents(chunk_texts)
        vector_store.upsert_chunks(
            collection_name=paper_collection,
            chunks=paper_chunks,
            vectors=chunk_vectors
        )

    if profiler:
        profiler.end_stage("Paper indexing", repo_chunks=0)

    # Perform topic-grounded retrieval
    if profiler:
        profiler.start_stage("Claim extraction", mode="sequential")

    if vector_store is not None:
        retriever = RAGRetriever(
            vector_store=vector_store,
            paper_collection=paper_collection,
            embedding_engine=embedding_engine
        )
        grounding_res = retriever.retrieve_paper_grounding_context(limit_per_topic=2)
        grounded_context = grounding_res["formatted_context"]
        all_retrieved_chunks = grounding_res["all_chunks"]
    else:
        # Fallback to top-4 chunks directly if vector store not initialized
        grounded_context = "\n\n".join(
            [f"=== [PAPER CHUNK p.{c.metadata.get('page_number', 1)} | Section: {c.metadata.get('section', 'General')} | ID: {c.chunk_id}] ===\n{c.content[:200]}" for c in paper_chunks[:4]]
        )
        all_retrieved_chunks = [
            {"chunk_id": c.chunk_id, "content": c.content, "metadata": c.metadata} for c in paper_chunks[:4]
        ]

    chunks_map = {c["chunk_id"]: c for c in all_retrieved_chunks}

    # Verify LLM provider availability
    provider = get_llm_provider()
    if not provider.is_configured:
        if profiler:
            profiler.end_stage("Claim extraction", claims=0, groq_requests=0)
        # REMOVED FAKE FALLBACK CLAIMS: Return explicit analysis_unavailable state
        return {
            "status": "analysis_unavailable",
            "error": "llm_unavailable",
            "reason": "LLM API key is not configured; grounded claim generation was not performed.",
            "paper_chunks_count": len(paper_chunks)
        }

    prompt = PROMPT_TEMPLATE.format(grounded_context=grounded_context)

    try:
        parsed_json = provider.generate_structured_json(prompt=prompt, max_tokens=8000)
        llm_calls = 1
    except (LLMProviderError, Exception) as prov_err:
        print(f"Initial LLM claim extraction failed ({prov_err}). Retrying once with strict concise JSON directive...")
        retry_prompt = (
            prompt
            + "\n\nCRITICAL REMINDER: Return valid JSON only. Do not include markdown code fences or text outside JSON. Keep each evidence quote concise (one short sentence) so the document completes safely."
        )
        try:
            parsed_json = provider.generate_structured_json(prompt=retry_prompt, max_tokens=8000)
            llm_calls = 2
        except (LLMProviderError, Exception) as retry_err:
            if profiler:
                profiler.end_stage("Claim extraction", claims=0, groq_requests=2)
            print(f"Retry LLM claim extraction failed: {retry_err}")
            return {
                "status": "analysis_unavailable",
                "error": "extraction_failed",
                "reason": str(retry_err),
                "paper_chunks_count": len(paper_chunks),
            }

    if profiler:
        profiler.end_stage("Claim extraction", groq_requests=llm_calls)

    if not isinstance(parsed_json, dict):
        return {
            "status": "analysis_unavailable",
            "error": "extraction_failed",
            "reason": "Invalid response format from claim extraction LLM.",
            "paper_chunks_count": len(paper_chunks)
        }

    # Python-verified metadata attachment: Never trust LLM hallucinated citations
    if parsed_json.get("dataset") and isinstance(parsed_json["dataset"], dict):
        parsed_json["dataset"] = _attach_verified_metadata(parsed_json["dataset"], chunks_map)

    if parsed_json.get("model_architecture") and isinstance(parsed_json["model_architecture"], dict):
        parsed_json["model_architecture"] = _attach_verified_metadata(parsed_json["model_architecture"], chunks_map)

    if parsed_json.get("hyperparameters") and isinstance(parsed_json["hyperparameters"], list):
        parsed_json["hyperparameters"] = [
            _attach_verified_metadata(hp, chunks_map) for hp in parsed_json["hyperparameters"] if isinstance(hp, dict)
        ]

    if parsed_json.get("claimed_metrics") and isinstance(parsed_json["claimed_metrics"], list):
        parsed_json["claimed_metrics"] = [
            _attach_verified_metadata(m, chunks_map) for m in parsed_json["claimed_metrics"] if isinstance(m, dict)
        ]

    parsed_json["paper_chunks_indexed"] = len(paper_chunks)
    parsed_json["grounding_chunks_used"] = len(all_retrieved_chunks)

    return parsed_json
