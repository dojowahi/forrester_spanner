from __future__ import annotations
from fastapi import APIRouter, Depends, Body, BackgroundTasks, File, UploadFile, Form
from backend.svc.core.clients import database, ai_client, embedding_client
from backend.svc.apis.search.mainmod import search_products, search_image
from backend.svc.apis.recommendations.submod import get_recommendations
from backend.svc.apis.fraud.submod import get_fraudulent_sessions
from backend.svc.apis.geo.submod import get_nearby_stores, get_nearby_customers_for_store
from backend.svc.apis.oltp.submod import update_cart, place_order
from backend.svc.apis.admin.submod import trigger_seed, trigger_truncate
from backend.svc.apis.debug.submod import get_table_samples

router = APIRouter()

from cachetools import TTLCache, cached
from google.cloud import storage
import io
from fastapi.responses import StreamingResponse, RedirectResponse
import datetime

@router.get("/debug/tables", tags=["admin"])
async def debug_tables():
    """Returns 5 rows from each table"""
    results = get_table_samples(database)
    return results

storage_client = storage.Client()
BUCKET_NAME = "gen-ai-4all-live-retail-images"

# Create a cache that holds up to 1024 items and has a TTL of 1 hour (3600 seconds)
signed_url_cache = TTLCache(maxsize=1024, ttl=3600)

@cached(signed_url_cache)
def generate_signed_url_for_product(product_id: str):
    """Generates a signed URL for a given product ID.
    The result of this function will be cached.
    """
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(f"products/{product_id}.jpg")
    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(hours=1),
        method="GET"
    )
    return url

@router.get("/images/{product_id}", tags=["discovery"])
def get_product_image(product_id: str):
    """Proxies the image from GCS to the client using Signed URLs for max performance"""
    try:
        url = generate_signed_url_for_product(product_id)
        return RedirectResponse(url)
    except Exception as sign_error:
        # 2. Fallback to Stream (Usually for local ADC credentials without signBlob permissions)
        try:
            bucket = storage_client.bucket(BUCKET_NAME)
            blob = bucket.blob(f"products/{product_id}.jpg")
            image_bytes = blob.download_as_bytes()
            headers = {"Cache-Control": "public, max-age=86400"}
            return StreamingResponse(io.BytesIO(image_bytes), media_type="image/jpeg", headers=headers)
        except Exception as e:
            return {"error": f"Failed to load image: {str(e)}"}

# --- Discovery & Search ---
@router.get("/products", tags=["discovery"])
async def get_products():
    """Returns basic products from the database for initial load"""
    from backend.svc.apis.search.submod import get_all_products
    results = get_all_products(database)
    return {"results": results}

@router.get("/search/hybrid", tags=["discovery"])
async def search_hybrid(query: str, mode: str = "hybrid"):
    """Combines Vector and Full-Text Search"""
    results = search_products(database, query=query, client_ai=embedding_client, mode=mode)
    return {"results": results}

@router.post("/search/image", tags=["discovery"])
async def search_image_endpoint(file: UploadFile = File(...), limit: int = Form(10)):
    """Accepts an image upload and executes exact neighbor vector search"""
    image_bytes = await file.read()
    results = search_image(database, image_bytes=image_bytes, client_ai=embedding_client, limit=limit)
    return {"results": results}

@router.get("/customers/{customer_id}/recommendations", tags=["discovery"])
async def recommendations(customer_id: str):
    """GQL Graph recommendations: Customers who bought this also bought Y"""
    actual_id = customer_id
    if customer_id == "mock-cust-id":
        try:
            with database.snapshot() as snapshot:
                # Find a customer who has made purchases to ensure recommendations exist
                rows = snapshot.execute_sql("SELECT CustomerId FROM OrderItems LIMIT 1")
                for row in rows:
                    actual_id = row[0]
                    break
        except Exception as e:
            print(f"Failed to find mock customer: {e}")
            
    results = get_recommendations(database, customer_id=actual_id)
    return results

# --- Analytics & Fraud ---
@router.get("/fraud/sessions", tags=["fraud"])
async def fraud_sessions():
    """GQL Graph analytical fraud clusters detection"""
    results = get_fraudulent_sessions(database)
    return results

# --- Geospatial ---
@router.get("/stores/nearby", tags=["geospatial"])
async def stores_nearby(lat: float, lon: float, radius_km: float = 50.0):
    """Geospatial Proximity finds nearby stores for promotion triggers"""
    results = get_nearby_stores(database, lat=lat, lon=lon, radius_km=radius_km)
    return {"nearby_stores": results}

@router.get("/stores/{store_id}/customers/nearby", tags=["geospatial"])
async def stores_customers_nearby(store_id: str, radius_km: float = 500.0):
    """Geospatial Proximity finds nearby customers around a specific store for promotions"""
    results = get_nearby_customers_for_store(database, store_id=store_id, radius_km=radius_km)
    return results

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
