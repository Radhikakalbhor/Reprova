import os
import tempfile
import threading
from typing import List, Generator

# Configure cache directories to a writable temporary directory (critical for read-only serverless runtimes like Vercel)
_TEMP_BASE = "/tmp" if os.name != "nt" and os.path.exists("/tmp") else tempfile.gettempdir()
FASTEMBED_CACHE_DIR = os.getenv("FASTEMBED_CACHE_PATH", os.path.join(_TEMP_BASE, "fastembed_cache"))
HF_HOME_DIR = os.getenv("HF_HOME", os.path.join(_TEMP_BASE, "huggingface"))

os.environ.setdefault("FASTEMBED_CACHE_PATH", FASTEMBED_CACHE_DIR)
os.environ.setdefault("HF_HOME", HF_HOME_DIR)
os.environ.setdefault("HF_HUB_CACHE", os.path.join(HF_HOME_DIR, "hub"))
os.environ.setdefault("TORCH_HOME", os.path.join(_TEMP_BASE, "torch"))

from fastembed import TextEmbedding

DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


class EmbeddingEngine:
    """
    Singleton FastEmbed text embedding engine using BAAI/bge-small-en-v1.5.
    Provides fast, local, CPU-friendly dense vector embeddings.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, model_name: str = DEFAULT_EMBEDDING_MODEL):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(EmbeddingEngine, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, model_name: str = DEFAULT_EMBEDDING_MODEL):
        if self._initialized:
            return
        self.model_name = model_name
        self.cache_dir = FASTEMBED_CACHE_DIR
        # Initialize FastEmbed ONNX model with explicit writable cache directory
        self.model = TextEmbedding(model_name=self.model_name, cache_dir=self.cache_dir)
        self.embedding_dimension = 384  # bge-small dimension
        self._initialized = True

    def embed_documents(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Generate dense embeddings for a list of document texts."""
        if not texts:
            return []

        # fastembed model.embed returns a generator of numpy arrays
        embeddings_gen = self.model.embed(texts, batch_size=batch_size)
        results: List[List[float]] = []
        for emb in embeddings_gen:
            results.append([float(val) for val in emb])
        return results

    def embed_query(self, query: str) -> List[float]:
        """Generate dense embedding for a single search query."""
        if not query or not query.strip():
            # Return zero vector if empty query
            return [0.0] * self.embedding_dimension

        # fastembed query_embed prepends query prefix if needed by the model
        if hasattr(self.model, "query_embed"):
            gen = self.model.query_embed([query])
        else:
            gen = self.model.embed([query])

        for emb in gen:
            return [float(val) for val in emb]

        return [0.0] * self.embedding_dimension


def get_embedding_engine(model_name: str = DEFAULT_EMBEDDING_MODEL) -> EmbeddingEngine:
    """Retrieve singleton EmbeddingEngine instance."""
    return EmbeddingEngine(model_name=model_name)
