from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner

def get_fraudulent_sessions(database) -> List[Dict]:
    """
    Detects fraud clusters: A single UserSession linked to multiple Customers.
    Path: (c1:Customers)<-[:BelongsTo]-(s:UserSessions)-[:BelongsTo]->(c2:Customers)
    """
    # Cypher/GQL query to find shared session/IP clusters
    query = """
        GRAPH RetailGraph
        MATCH (c1:Customers)<-[:BelongsTo]-(s:UserSessions)-[:BelongsTo]->(c2:Customers)
        WHERE c1.CustomerId <> c2.CustomerId
        RETURN DISTINCT s.SessionId AS SessionId, s.IPAddress AS IPAddress, c1.CustomerId AS CustomerA, c2.CustomerId AS CustomerB
        LIMIT 10
    """
    
    results = []
    try:
        with database.snapshot() as snapshot:
            print("Executing Fraud Detection Graph query...")
            rows = snapshot.execute_sql(query)
            for row in rows:
                results.append({
                    "SessionId": row[0],
                    "IPAddress": row[1],
                    "CustomerA": row[2],
                    "CustomerB": row[3]
                })
    except Exception as e:
        print(f"Fraud Graph query failed: {e}")
        return []
        
    return results
