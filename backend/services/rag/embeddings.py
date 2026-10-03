import threading
from typing import List, Generator
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
        # Initialize FastEmbed ONNX model
        self.model = TextEmbedding(model_name=self.model_name)
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
