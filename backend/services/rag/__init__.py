"""
RAG Package for Reprova.
Provides modular paper and code chunking, FastEmbed embeddings,
ephemeral in-memory Qdrant vector storage, and grounded evidence retrieval.
"""

from .chunkers import Chunk, PaperChunker, CodeChunker
from .embeddings import EmbeddingEngine, get_embedding_engine
from .vector_store import ReprovaVectorStore
from .retriever import RAGRetriever

__all__ = [
    "Chunk",
    "PaperChunker",
    "CodeChunker",
    "EmbeddingEngine",
    "get_embedding_engine",
    "ReprovaVectorStore",
    "RAGRetriever",
]
