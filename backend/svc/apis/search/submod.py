from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner

def hybrid_search(database, vector_emb: List[float], query_text: str, limit: int = 10, mode: str = "hybrid") -> List[Dict]:
    """
    Executes Hybrid Search Combining Vector Distance and Full-Text tokens based on mode.
    """
    if mode == "fulltext":
        query = """
            SELECT ProductId, Name, Description, ThumbnailUrl, Price, Category
            FROM Products
            WHERE SEARCH(SearchTokens, @text_query)
            LIMIT @limit
        """
        params = {"text_query": query_text, "limit": limit}
        param_types = {"text_query": spanner.param_types.STRING, "limit": spanner.param_types.INT64}
    elif mode == "embedding":
        query = """
            SELECT ProductId, Name, Description, ThumbnailUrl, Price, Category
            FROM Products
            ORDER BY COSINE_DISTANCE(DescriptionEmbedding, @vector_emb) ASC
            LIMIT @limit
        """
        params = {"vector_emb": vector_emb, "limit": limit}
        param_types = {"vector_emb": spanner.param_types.Array(spanner.param_types.FLOAT32), "limit": spanner.param_types.INT64}
    else: # hybrid
        query = """
            WITH Matchers AS (
                SELECT ProductId, 0 as match_tier FROM Products WHERE SEARCH(SearchTokens, @text_query)
            )
            SELECT p.ProductId, p.Name, p.Description, p.ThumbnailUrl, p.Price, p.Category
            FROM Products p
            LEFT JOIN Matchers m ON p.ProductId = m.ProductId
            ORDER BY
                COALESCE(m.match_tier, 1) ASC,
                (
                    COSINE_DISTANCE(p.DescriptionEmbedding, @vector_emb) * 0.70 +
                    COALESCE(COSINE_DISTANCE(p.ImageEmbedding, @vector_emb), COSINE_DISTANCE(p.DescriptionEmbedding, @vector_emb)) * 0.30
                ) ASC
            LIMIT @limit
        """
        params = {"text_query": query_text, "vector_emb": vector_emb, "limit": limit}
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
                    "Name": row[1],
                    "Description": row[2],
                    "ImageUrl": row[3],
                    "Price": row[4],
                    "Category": row[5]
                })
    except Exception as e:
        print(f"Hybrid Search failed: {e}")
        return []
        
    return results

def image_search(database, vector_emb: List[float], limit: int = 10) -> List[Dict]:
    """
    Executes Vector Search based purely on Image Embedding Distance.
    """
    query = """
        SELECT ProductId, Name, Description, ThumbnailUrl, Price, Category, COSINE_DISTANCE(ImageEmbedding, @vector_emb) as distance
        FROM Products
        WHERE ImageEmbedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT @limit
    """
    
    params = {
        "vector_emb": vector_emb,
        "limit": limit
    }
    
    param_types = {
        "vector_emb": spanner.param_types.Array(spanner.param_types.FLOAT32),
        "limit": spanner.param_types.INT64
    }
    
    results = []
    try:
        with database.snapshot() as snapshot:
            print("Executing Image Vector Search")
            rows = snapshot.execute_sql(query, params=params, param_types=param_types)
            for row in rows:
                results.append({
                    "ProductId": row[0],
                    "Name": row[1],
                    "Description": row[2],
                    "ImageUrl": row[3],
                    "Price": row[4],
                    "Category": row[5],
                    "distance": row[6]
                })
    except Exception as e:
        print(f"Image Vector Search failed: {e}")
        return []
        
    return results

def get_all_products(database, limit: int = 8) -> List[Dict]:
    """
    Fetches basic products from the DB for initial UI load.
    """
    query = """
        SELECT ProductId, Name, Description, ThumbnailUrl, Price, Category
        FROM Products
        LIMIT @limit
    """
    
    params = {"limit": limit}
    param_types = {"limit": spanner.param_types.INT64}
    
    results = []
    try:
        with database.snapshot() as snapshot:
            rows = snapshot.execute_sql(query, params=params, param_types=param_types)
            for row in rows:
                results.append({
                    "ProductId": row[0],
                    "Name": row[1],
                    "Description": row[2],
                    "ImageUrl": row[3],
                    "Price": row[4],
                    "Category": row[5]
                })
    except Exception as e:
        print(f"Fetch products failed: {e}")
        return []
        
    return results
