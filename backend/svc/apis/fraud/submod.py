from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner

def get_fraudulent_sessions(database) -> Dict:
    """
    Detects fraud clusters: A single UserSession linked to multiple Customers.
    Path: (c1:Customers)<-[:BelongsTo]-(s:UserSessions)-[:BelongsTo]->(c2:Customers)
    """
    query = """
        SELECT results.s_SessionId, results.PaymentMethodToken
        FROM GRAPH_TABLE(
            RetailGraph
            MATCH (s:UserSessions)<-[e:AuthoredBy]-(p:Payments)
            COLUMNS (s.SessionId AS s_SessionId, p.PaymentMethodToken as PaymentMethodToken)
        ) AS results
    """
    
    aggregates = []
    nodes = []
    edges = []
    
    try:
        with database.snapshot() as snapshot:
            print("Executing Fraud Detection Graph query...")
            # Spanner doesn't support complex Window functions combined with HAVING right in the outer select in all cases
            # so we fetch all session-payment rows and process in Python for the visualization
            rows = snapshot.execute_sql(query)
            
            session_cards = {}
            for row in rows:
                sid = row[0]
                card = row[1]
                if sid not in session_cards:
                    session_cards[sid] = set()
                session_cards[sid].add(card)
                
            # Filter to fraud clusters (CardCount > 1) and Top 10
            fraud_sessions = {s: cards for s, cards in session_cards.items() if len(cards) > 1}
            top_fraud = sorted(fraud_sessions.items(), key=lambda x: len(x[1]), reverse=True)[:10]
            
            seen_nodes = set()
            for sid, cards in top_fraud:
                aggregates.append({"s_SessionId": sid, "CardCount": len(cards)})
                
                # Add Session Node
                if sid not in seen_nodes:
                    nodes.append({"id": sid, "group": "Session", "val": 20})
                    seen_nodes.add(sid)
                    
                # Add Card Nodes and Edges
                for card in cards:
                    if card not in seen_nodes:
                        nodes.append({"id": card, "group": "Card", "val": 10})
                        seen_nodes.add(card)
                    edges.append({"source": sid, "target": card})

    except Exception as e:
        print(f"Fraud Graph query failed: {e}")
        return {"fraud_clusters": [], "graph": {"nodes": [], "edges": []}}
        
    return {"fraud_clusters": aggregates, "graph": {"nodes": nodes, "edges": edges}}
