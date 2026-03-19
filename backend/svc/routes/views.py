from __future__ import annotations
from fastapi import APIRouter, Depends, Body, BackgroundTasks
from backend.svc.core.clients import database, ai_client
from backend.svc.apis.search.mainmod import search_products
from backend.svc.apis.recommendations.submod import get_recommendations
from backend.svc.apis.fraud.submod import get_fraudulent_sessions
from backend.svc.apis.geo.submod import get_nearby_stores
from backend.svc.apis.oltp.submod import update_cart, place_order
from backend.svc.apis.admin.submod import trigger_seed, trigger_truncate

router = APIRouter()

# --- Discovery & Search ---
@router.get("/search/hybrid", tags=["discovery"])
async def search_hybrid(query: str):
    """Combines Vector and Full-Text Search"""
    results = search_products(database, query=query, client_ai=ai_client)
    return {"results": results}

@router.get("/customers/{customer_id}/recommendations", tags=["discovery"])
async def recommendations(customer_id: str):
    """GQL Graph recommendations: Customers who bought this also bought Y"""
    results = get_recommendations(database, customer_id=customer_id)
    return {"recommendations": results}

# --- Analytics & Fraud ---
@router.get("/fraud/sessions", tags=["fraud"])
async def fraud_sessions():
    """GQL Graph analytical fraud clusters detection"""
    results = get_fraudulent_sessions(database)
    return {"fraud_clusters": results}

# --- Geospatial ---
@router.get("/stores/nearby", tags=["geospatial"])
async def stores_nearby(lat: float, lon: float, radius_km: float = 50.0):
    """Geospatial Proximity finds nearby stores for promotion triggers"""
    results = get_nearby_stores(database, lat=lat, lon=lon, radius_km=radius_km)
    return {"nearby_stores": results}

# --- OLTP Flow ---
@router.post("/cart/items", tags=["oltp"])
async def cart_items_update(session_id: str, items: list = Body(...)):
    """Updates active cart items for a session"""
    success = update_cart(database, session_id=session_id, cart_items=items)
    return {"success": success}

@router.get("/orders", tags=["oltp"])
@router.post("/orders", tags=["oltp"])
async def create_order(customer_id: str, store_id: str, session_id: str, items: list = Body(...)):
    """Places an order atomically across Orders, OrderItems, Payments, and UserSessions"""
    order_id = place_order(database, customer_id=customer_id, store_id=store_id, session_id=session_id, items=items)
    return {"order_id": order_id}

# --- Administrative ---
@router.post("/admin/seed", tags=["admin"])
async def admin_seed(
    background_tasks: BackgroundTasks,
    part: str = "all", 
    products: int = 2, 
    stores: int = 3, 
    customers: int = 9,
    sessions: int = 5,
    payments: int = 10,
    orders: int = 10,
    order_items: int = 20
):
    """Triggers dataset seeding with optional parameters in the background"""
    params = {
        "part": part, 
        "products": products, 
        "stores": stores, 
        "customers": customers, 
        "sessions": sessions, 
        "payments": payments, 
        "orders": orders, 
        "order_items": order_items
    }
    background_tasks.add_task(trigger_seed, params)
    return {"success": True, "message": "Seeding task started in the background. Check server logs for status."}

@router.post("/admin/truncate", tags=["admin"])
async def admin_truncate(background_tasks: BackgroundTasks):
    """Triggers dataset truncation/cleanup in the background"""
    background_tasks.add_task(trigger_truncate)
    return {"success": True, "message": "Truncation task started in the background. Check server logs for status."}
