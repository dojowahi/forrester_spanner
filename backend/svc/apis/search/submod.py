from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner

def hybrid_search(database, vector_emb: List[float], query_text: str, limit: int = 10) -> List[Dict]:
    """
    Executes Hybrid Search Combining Vector Distance and Full-Text tokens.
    """
    # Spanner full-text search requires token conditions.
    query = """
        SELECT ProductId, Name, Description, ThumbnailUrl, Price, Category
        FROM Products
        WHERE SEARCH(SearchTokens, @text_query)
        ORDER BY COSINE_DISTANCE(DescriptionEmbedding, @vector_emb) ASC
        LIMIT @limit
    """
    
    params = {
        "text_query": query_text,
        "vector_emb": vector_emb,
        "limit": limit
    }
    
    param_types = {
        "text_query": spanner.param_types.STRING,
        "vector_emb": spanner.param_types.Array(spanner.param_types.FLOAT32),
        "limit": spanner.param_types.INT64
    }
    
    results = []
    try:
        with database.snapshot() as snapshot:
            print(f"Executing Hybrid Search for: {query_text}")
            rows = snapshot.execute_sql(query, params=params, param_types=param_types)
            for row in rows:
                results.append({
                    "ProductId": row[0],
                    "ProductName": row[1],
                    "Description": row[2],
                    "ImageUrl": row[3],
                    "Price": row[4],
                    "Category": row[5]
                })
    except Exception as e:
        print(f"Hybrid Search failed: {e}")
        # Return empty list or raise
        return []
        
    return results
