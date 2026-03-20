from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner

def get_recommendations(database, customer_id: str, limit: int = 5) -> Dict:
    """
    Traverses graph to perform collaborative filtering recommendations:
    Customers who bought items that Customer X bought also bought Y.
    """
    query = """
        SELECT results.P1Name, results.PeerId, results.P2Name
        FROM GRAPH_TABLE(
            RetailGraph
            MATCH (c1:Customers {CustomerId: @customer_id})-[:Purchased]->(p1:Products)<-[:Purchased]-(c2:Customers)-[:Purchased]->(p2:Products)
            WHERE p1.ProductId <> p2.ProductId AND c1.CustomerId <> c2.CustomerId
            COLUMNS (p1.Name AS P1Name, c2.CustomerId AS PeerId, p2.Name AS P2Name)
        ) AS results
    """
    
    params = {
        "customer_id": customer_id,
    }
    
    aggregates = []
    nodes = []
    edges = []
    
    try:
        with database.snapshot() as snapshot:
            print(f"Executing Graph Recommendations for Customer: {customer_id}")
            from google.cloud.spanner_v1 import param_types
            ptypes = {"customer_id": param_types.STRING}
            rows = snapshot.execute_sql(query, params=params, param_types=ptypes)
            
            # Aggregate in python
            rec_counts = {}
            paths = []
            
            for row in rows:
                p1 = row[0]
                peer = row[1]
                p2 = row[2]
                
                paths.append((p1, peer, p2))
                if p2 not in rec_counts:
                    rec_counts[p2] = set()
                rec_counts[p2].add(peer)
                
            top_recs = sorted(rec_counts.items(), key=lambda x: len(x[1]), reverse=True)[:limit]
            top_rec_names = {r[0] for r in top_recs}
            
            seen_nodes = {"You"}
            nodes.append({"id": "You", "group": "You", "val": 20})
            
            for p2, peers in top_recs:
                aggregates.append({"p_Name": p2, "PeerPurchaseCount": len(peers)})
                
            # Filter paths to only include the top recommendations
            paired_peers = {}
            for p1, peer, p2 in paths:
                if p2 in top_rec_names:
                    # Prevent hairball by rendering max 2 peers per P1->P2 path
                    pair_key = (p1, p2)
                    if pair_key not in paired_peers:
                        paired_peers[pair_key] = 0
                    if paired_peers[pair_key] >= 2:
                        continue
                    paired_peers[pair_key] += 1
                    
                    # Target Customer -> P1
                    if p1 not in seen_nodes:
                        nodes.append({"id": p1, "group": "Product", "val": 15})
                        seen_nodes.add(p1)
                    edges.append({"source": "You", "target": p1})
                    
                    # P1 -> Peer
                    if peer not in seen_nodes:
                        nodes.append({"id": peer, "group": "Peer", "val": 10})
                        seen_nodes.add(peer)
                    edges.append({"source": p1, "target": peer})
                    
                    # Peer -> P2
                    if p2 not in seen_nodes:
                        nodes.append({"id": p2, "group": "Recommended Product", "val": 20})
                        seen_nodes.add(p2)
                    edges.append({"source": peer, "target": p2})

    except Exception as e:
        print(f"Recommendations Graph query failed: {e}")
        return {"recommendations": [], "graph": {"nodes": [], "edges": []}}
        
    return {"recommendations": aggregates, "graph": {"nodes": nodes, "edges": edges}}
