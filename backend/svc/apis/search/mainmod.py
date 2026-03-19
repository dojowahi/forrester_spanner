from __future__ import annotations
from backend.svc.apis.search.submod import hybrid_search
from backend.ai import get_embeddings

def search_products(database, query: str, client_ai) -> list:
    """
    Orchestrates Hybrid Search:
    1. Generates Text Embeddings via Gemini.
    2. Calls Spanner Hybrid Search logic.
    """
    print(f"Orchestrating search for query: {query}")
    # 1. Get embedding vector for query
    vector_emb = get_embeddings(client_ai, text=query)
    
    # 2. Execute Hybrid Search (Vector + FTS)
    return hybrid_search(database, vector_emb, query_text=query)
