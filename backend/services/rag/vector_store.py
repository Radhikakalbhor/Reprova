import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from .chunkers import Chunk


class ReprovaVectorStore:
    """
    Session-scoped, ephemeral in-memory Qdrant vector store.
    Manages isolated collections for research paper and repository code chunks.
    """

    def __init__(self, dimension: int = 384):
        self.dimension = dimension
        self.client = QdrantClient(":memory:")
        self._collections: set = set()

    def create_collection(self, collection_name: str) -> None:
        """Create an in-memory collection with Cosine distance metric."""
        if collection_name not in self._collections:
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=self.dimension,
                    distance=models.Distance.COSINE,
                ),
            )
            self._collections.add(collection_name)

    def upsert_chunks(
        self,
        collection_name: str,
        chunks: List[Chunk],
        vectors: List[List[float]],
    ) -> None:
        """Upload chunks and their dense vectors into the specified collection."""
        if not chunks or not vectors or len(chunks) != len(vectors):
            return

        self.create_collection(collection_name)

        points = []
        for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{collection_name}_{chunk.chunk_id}_{idx}"))
            payload = {
                "chunk_id": chunk.chunk_id,
                "source_type": chunk.source_type,
                "content": chunk.content,
                **chunk.metadata,
            }
            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            )

        # Batch upsert points
        batch_size = 64
        for i in range(0, len(points), batch_size):
            self.client.upsert(
                collection_name=collection_name,
                points=points[i : i + batch_size],
            )

    def search(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 5,
        score_threshold: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Search collection for top-k nearest neighbor chunks."""
        if collection_name not in self._collections:
            return []

        try:
            # In qdrant-client >= 1.7+, use query_points or search
            if hasattr(self.client, "query_points"):
                results = self.client.query_points(
                    collection_name=collection_name,
                    query=query_vector,
                    limit=limit,
                    score_threshold=score_threshold,
                    with_payload=True,
                ).points
            else:
                results = self.client.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=limit,
                    score_threshold=score_threshold,
                    with_payload=True,
                )

            hits: List[Dict[str, Any]] = []
            for hit in results:
                payload = hit.payload or {}
                hits.append(
                    {
                        "chunk_id": payload.get("chunk_id", str(hit.id)),
                        "source_type": payload.get("source_type", ""),
                        "score": round(float(hit.score), 4),
                        "content": payload.get("content", ""),
                        "metadata": payload,
                    }
                )
            return hits
        except Exception as e:
            print(f"Error searching collection {collection_name}: {e}")
            return []

    def cleanup(self) -> None:
        """Delete all collections and free in-memory data structures."""
        try:
            for col in list(self._collections):
                try:
                    self.client.delete_collection(col)
                except Exception:
                    pass
            self._collections.clear()
            self.client.close()
        except Exception:
            pass
