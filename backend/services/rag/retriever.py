import os
import re
from typing import List, Dict, Any, Optional
from .vector_store import ReprovaVectorStore
from .embeddings import EmbeddingEngine, get_embedding_engine

DEFAULT_CODE_SIMILARITY_THRESHOLD = float(os.getenv("RAG_CODE_SIMILARITY_THRESHOLD", "0.70"))


class RAGRetriever:
    """
    Unified evidence retriever for research paper and repository code vector indices.
    Extracts grounded context and machine-generated citation headers for LLM verification.
    """

    PAPER_TOPIC_QUERIES = {
        "dataset": "primary dataset name benchmark source corpus dataset split training evaluation data 100-class subset Flickr ImageNet CIFAR",
        "model_architecture": "model architecture neural network layers parameters ResNet ResNet-50 DenseNet PyramidNet benchmark backbone",
        "hyperparameters": "hyperparameters learning rate batch size optimizer SGD stochastic gradient descent epochs early stopping warmup weight decay schedule dropout",
        "claimed_metrics": "evaluation metric accuracy top-1 classification error F1 score loss benchmark reported performance improvement gap 10.56% 15% 4.44%",
        "training_experiments": "experimental setup methodology implementation details training with SGD ResNet-50 candidate training set 60 epochs 30 epochs early stopping clean subset noisy dataset",
        "training_optimizer": "training with SGD stochastic gradient descent ResNet-50 model 60 epochs early stopping 4.44% better performance 10.56% 15%",
        "data_quality": "noisy labels label noise candidate examples false-label-rate clean subset 50% wrong labels",
    }

    def __init__(
        self,
        vector_store: ReprovaVectorStore,
        paper_collection: str = "paper_chunks",
        code_collection: str = "code_chunks",
        embedding_engine: Optional[EmbeddingEngine] = None,
        code_similarity_threshold: float = DEFAULT_CODE_SIMILARITY_THRESHOLD,
    ):
        self.vector_store = vector_store
        self.paper_collection = paper_collection
        self.code_collection = code_collection
        self.embedding_engine = embedding_engine or get_embedding_engine()
        self.code_similarity_threshold = code_similarity_threshold

    # --- PAPER RETRIEVAL ---

    def retrieve_paper_chunks_for_query(
        self, query: str, limit: int = 4, score_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve top-k paper chunks matching a textual query."""
        query_vector = self.embedding_engine.embed_query(query)
        return self.vector_store.search(
            collection_name=self.paper_collection,
            query_vector=query_vector,
            limit=limit,
            score_threshold=score_threshold,
        )

    def retrieve_paper_grounding_context(
        self, limit_per_topic: int = 2
    ) -> Dict[str, Any]:
        """
        Run targeted topic retrievals for dataset, architecture, hyperparameters, metrics, and experiments.
        Returns deduplicated chunks and formatted prompt text with machine-generated citations.
        """
        seen_chunk_ids = set()
        retrieved_by_topic: Dict[str, List[Dict[str, Any]]] = {}
        all_chunks: List[Dict[str, Any]] = []

        for topic, query_str in self.PAPER_TOPIC_QUERIES.items():
            hits = self.retrieve_paper_chunks_for_query(query_str, limit=limit_per_topic)
            topic_hits = []
            for hit in hits:
                topic_hits.append(hit)
                if hit["chunk_id"] not in seen_chunk_ids:
                    seen_chunk_ids.add(hit["chunk_id"])
                    all_chunks.append(hit)
            retrieved_by_topic[topic] = topic_hits

        # Format grounded evidence blocks for LLM consumption (top 10 unique chunks preserving full chunk context)
        evidence_blocks = []
        selected_chunks = all_chunks[:10]
        for c in selected_chunks:
            meta = c.get("metadata", {})
            p_num = meta.get("page_number", 1)
            sec = meta.get("section", "General")
            c_id = c.get("chunk_id", "paper-chunk")
            content = c.get("content", "").strip()
            score = c.get("score", 0.0)

            block = (
                f"=== [PAPER CHUNK p.{p_num} | Section: {sec} | ID: {c_id} | Relevance: {score:.3f}] ===\n"
                f"{content}\n"
            )
            evidence_blocks.append(block)

        formatted_context = "\n".join(evidence_blocks) if evidence_blocks else "No extractable paper chunks found."

        return {
            "all_chunks": selected_chunks,
            "retrieved_by_topic": retrieved_by_topic,
            "formatted_context": formatted_context,
            "total_chunks_retrieved": len(selected_chunks),
        }

    # --- REPOSITORY CODE RETRIEVAL ---

    def retrieve_code_evidence_for_claim(
        self,
        claim_description: str,
        paper_evidence: Optional[str] = None,
        limit: int = 4,
        score_threshold: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve code chunks from repository index relevant to a paper claim.
        Enforces configurable similarity threshold (default: 0.70).
        """
        # Formulate query combining claim text and key terms
        query_parts = [claim_description]
        if paper_evidence and paper_evidence != "N/A" and len(paper_evidence) > 10:
            # Extract key tokens from evidence (names, parameters, numbers)
            evidence_keywords = [
                w for w in re.findall(r"\b[a-zA-Z0-9_\-\.]+\b", paper_evidence)
                if len(w) > 3 and w.lower() not in {"this", "that", "with", "from", "were", "using"}
            ][:6]
            if evidence_keywords:
                query_parts.append(" ".join(evidence_keywords))

        query = " ".join(query_parts)
        query_vector = self.embedding_engine.embed_query(query)

        hits = self.vector_store.search(
            collection_name=self.code_collection,
            query_vector=query_vector,
            limit=limit,
            score_threshold=score_threshold,
        )

        return hits
