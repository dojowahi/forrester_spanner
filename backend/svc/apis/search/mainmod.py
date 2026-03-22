from __future__ import annotations
from backend.svc.apis.search.submod import hybrid_search
from backend.ai import get_embeddings

def search_products(database, query: str, client_ai, mode: str = "hybrid", geo: str = "global") -> list:
    """
    Orchestrates Hybrid Search:
    1. Generates Text Embeddings via Gemini.
    2. Calls Spanner Hybrid Search logic.
    """
    print(f"Orchestrating search for query: {query} in mode: {mode} in geo: {geo}")
    # 1. Get embedding vector for query
    vector_emb = get_embeddings(client_ai, text=query)
    
    # 2. Execute Search Based on Mode
    return hybrid_search(database, vector_emb, query_text=query, mode=mode, geo=geo)

def search_image(database, image_bytes: bytes, client_ai, limit: int = 10, geo: str = "global") -> list:
    """
    Orchestrates Multimodal Image Search:
    1. Generates Image Embeddings via Gemini.
    2. Calls Spanner Vector Distance search logic.
    """
    print(f"Orchestrating image search in geo: {geo}")
    
    from backend.svc.apis.search.submod import image_search
    # 1. Get embedding vector for image
    vector_emb = get_embeddings(client_ai, image_bytes=image_bytes)
    
    # 2. Execute Image Vector Search
    return image_search(database, vector_emb, limit=limit, geo=geo)
