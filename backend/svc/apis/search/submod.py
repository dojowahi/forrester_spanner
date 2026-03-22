from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner

def hybrid_search(database, vector_emb: List[float], query_text: str, limit: int = 10, mode: str = "hybrid", geo: str = "global") -> List[Dict]:
    """
    Executes Hybrid Search Combining Vector Distance and Full-Text tokens based on mode.
    """
    geo_join = ""
    geo_where = "\n            AND EXISTS (SELECT 1 FROM Inventory i JOIN Stores s ON i.StoreId = s.StoreId WHERE i.ProductId = p.ProductId AND s.PlacementKey = @geo)" if geo != "global" else ""

    if mode == "fulltext":
        query = f"""
            SELECT p.ProductId, p.Name, p.Description, p.ThumbnailUrl, p.Price, p.Category
            FROM Products p {geo_join}
            WHERE SEARCH(p.SearchTokens, @text_query) {geo_where}
            LIMIT @limit
        """
        params = {"text_query": query_text, "limit": limit}
        param_types = {"text_query": spanner.param_types.STRING, "limit": spanner.param_types.INT64}
    elif mode == "embedding":
        query = f"""
            SELECT p.ProductId, p.Name, p.Description, p.ThumbnailUrl, p.Price, p.Category
            FROM Products p {geo_join}
            WHERE p.DescriptionEmbedding IS NOT NULL {geo_where}
            ORDER BY COSINE_DISTANCE(p.DescriptionEmbedding, @vector_emb) ASC
            LIMIT @limit
        """
        params = {"vector_emb": vector_emb, "limit": limit}
        param_types = {"vector_emb": spanner.param_types.Array(spanner.param_types.FLOAT32), "limit": spanner.param_types.INT64}
    else: # hybrid
        query = f"""
            WITH Matchers AS (
                SELECT ProductId, 0 as match_tier FROM Products WHERE SEARCH(SearchTokens, @text_query)
            )
            SELECT p.ProductId, p.Name, p.Description, p.ThumbnailUrl, p.Price, p.Category
            FROM Products p {geo_join}
            LEFT JOIN Matchers m ON p.ProductId = m.ProductId
            WHERE 1=1 {geo_where}
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
    
    if geo != "global":
        params["geo"] = geo
        param_types["geo"] = spanner.param_types.STRING
        
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

def image_search(database, vector_emb: List[float], limit: int = 10, geo: str = "global") -> List[Dict]:
    """
    Executes Vector Search based purely on Image Embedding Distance.
    """
    geo_join = ""
    geo_where = "\n        AND EXISTS (SELECT 1 FROM Inventory i JOIN Stores s ON i.StoreId = s.StoreId WHERE i.ProductId = p.ProductId AND s.PlacementKey = @geo)" if geo != "global" else ""
    
    query = f"""
        SELECT p.ProductId, p.Name, p.Description, p.ThumbnailUrl, p.Price, p.Category, COSINE_DISTANCE(p.ImageEmbedding, @vector_emb) as distance
        FROM Products p {geo_join}
        WHERE p.ImageEmbedding IS NOT NULL {geo_where}
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
    
    if geo != "global":
        params["geo"] = geo
        param_types["geo"] = spanner.param_types.STRING
    
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

def get_all_products(database, limit: int = 8, geo: str = "global") -> List[Dict]:
    """
    Fetches basic products from the DB for initial UI load.
    """
    geo_join = ""
    geo_where = "\n        WHERE EXISTS (SELECT 1 FROM Inventory i JOIN Stores s ON i.StoreId = s.StoreId WHERE i.ProductId = p.ProductId AND s.PlacementKey = @geo)" if geo != "global" else ""
    
    query = f"""
        SELECT p.ProductId, p.Name, p.Description, p.ThumbnailUrl, p.Price, p.Category
        FROM Products p {geo_join} {geo_where}
        LIMIT @limit
    """
    
    params = {"limit": limit}
    param_types = {"limit": spanner.param_types.INT64}
    
    if geo != "global":
        params["geo"] = geo
        param_types["geo"] = spanner.param_types.STRING
    
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
