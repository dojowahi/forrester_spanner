from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner

def get_recommendations(database, customer_id: str, limit: int = 5) -> List[Dict]:
    """
    Traverses graph to perform collaborative filtering recommendations:
    Customers who bought items that Customer X bought also bought Y.
    Path: (c1:Customers)-[:Purchased]->(p1:Products)<-[:Purchased]-(c2:Customers)-[:Purchased]->(p2:Products)
    """
    # Cypher/GQL query on Spanner Property Graph
    query = """
        GRAPH RetailGraph
        MATCH (c1:Customers {CustomerId: @customer_id})-[:Purchased]->(p1:Products)<-[:Purchased]-(c2:Customers)-[:Purchased]->(p2:Products)
        WHERE p1.ProductId <> p2.ProductId
        -- Distinct recommendations to avoid duplicates
        RETURN DISTINCT p2.ProductId AS ProductId, p2.Name AS Name, p2.Category AS Category, p2.Price AS Price
        LIMIT @limit
    """
    
    params = {
        "customer_id": customer_id,
        "limit": limit
    }
    
    results = []
    try:
        with database.snapshot() as snapshot:
            print(f"Executing Graph Recommendations for Customer: {customer_id}")
            rows = snapshot.execute_sql(query, params=params)
            for row in rows:
                results.append({
                    "ProductId": row[0],
                    "Name": row[1],
                    "Category": row[2],
                    "Price": float(row[3]) if row[3] is not None else 0.0
                })
    except Exception as e:
        print(f"Recommendations Graph query failed: {e}")
        return []
        
    return results
