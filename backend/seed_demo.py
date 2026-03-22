import sys
from loguru import logger
from decimal import Decimal
import ctypes
import argparse
import os
import random
import uuid
from datetime import datetime
from google.cloud import spanner
from google import genai
from google.genai import types

# Add root to path for backend importing
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.config import settings
from backend.ai import get_embeddings, generate_image

import math

# Coordinate Hubs for Placements
PLACEMENT_REGIONS = {
    "americas": [
        {"lat": 34.0522, "lon": -118.2437}, # Los Angeles, CA
        {"lat": 37.7749, "lon": -122.4194}, # San Francisco, CA
        {"lat": 44.9778, "lon": -93.2650},  # Minneapolis, MN
        {"lat": 40.7128, "lon": -74.0060}   # New York City, NY
    ],
    "europe": [
        {"lat": 51.5074, "lon": -0.1278},  # London, UK
        {"lat": 53.4808, "lon": -2.2426},  # Manchester, UK
        {"lat": 52.4862, "lon": -1.8904},  # Birmingham, UK
        {"lat": 55.9533, "lon": -3.1883}   # Edinburgh, UK
    ],
    "asia": [
        {"lat": 19.0760, "lon": 72.8777},  # Mumbai, India
        {"lat": 28.6139, "lon": 77.2090},  # New Delhi, India
        {"lat": 12.9716, "lon": 77.5946}   # Bangalore, India
    ]
}

def add_random_radius(lat, lon, max_km=5.0, exact_km=None):
    distance_km = exact_km if exact_km is not None else random.uniform(0, max_km)
    angle = random.uniform(0, 2 * math.pi)
    delta_lat = (distance_km * math.cos(angle)) / 111.0
    delta_lon = (distance_km * math.sin(angle)) / (111.0 * math.cos(math.radians(lat)))
    return lat + delta_lat, lon + delta_lon

try:
    import s2sphere
    def get_s2_cell_id(lat, lon):
        cell = s2sphere.CellId.from_lat_lng(s2sphere.LatLng.from_degrees(lat, lon))
        return ctypes.c_int64(cell.id()).value
except ImportError:
    logger.warning("s2sphere not installed. Using mock S2CellId generation.")
    def get_s2_cell_id(lat, lon):
        # Generate a deterministic 64-bit integer based on lat/lon mock
        val = int((lat + 90) * 1000000) * 1000000 + int((lon + 180) * 1000000)
        return ctypes.c_int64(val).value

PRODUCT_PROMPTS = [
    "minimalist smart watch with AMOLED screen",
    "noise-canceling over-ear headphones pack",
    "4K ultra-wide curve computer monitor spec",
    "retro-style record player with bluetooth",
    "mechanical gaming keyboard with RGB switches",
    "ultra-lightweight wireless gaming mouse",
    "smart home security camera 1080p",
    "high-fidelity bookshelf speakers set",
    "streaming webcam with ring light",
    "professional podcasting microphone",
    "Compact 4K laser projector",
    "Braided nylon fast-charging cable with LED indicator",
    "Ergonomic office chair with lumbar support"]

def generate_gemini_products(client, model_name=None, count=5):
    """Generates realistic products using Gemini AI and structured output."""
    if model_name is None:
        model_name = settings.TEXT_MODEL
        
    # Cycle prompts to cover the requested count
    selected_prompts = (PRODUCT_PROMPTS * (count // len(PRODUCT_PROMPTS) + 1))[:count]
    total_samples = len(selected_prompts)
    
    prompt = f"""
    Generate a realistic retail product for each of the following themes: {", ".join(selected_prompts)}.
    For each item in the list, generate 1 distinct product.
    Include Name, Description (rich retail description that would match embeddings better), Price (numeric between 5 and 500), and Category (Electronics, Fashion, Home, Sports, Beauty).
    Return as JSON matching the requested structure in exactly {total_samples} items.
    """
    
    from pydantic import BaseModel
    
    class Product(BaseModel):
        name: str
        description: str
        price: float
        category: str

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[Product],
            ),
        )
        import json
        return json.loads(response.text)
    except Exception as e:
        logger.warning(f"Gemini Product Generation failed: {e}")
        # Fallback static data
        return [
            {"name": "Ultra-light Running Shoes", "description": "Breathable mesh upper with foam comfort.", "price": 89.99, "category": "Fashion"},
            {"name": "Smart Speaker Elite", "description": "Voice assistant with premium acoustics.", "price": 129.50, "category": "Electronics"},
            {"name": "Eco-friendly Water Bottle", "description": "Stainless steel insulated leak-proof cap.", "price": 24.99, "category": "Home"}
        ]

# get_embeddings and generate_image moved to backend/ai.py

def seed_data(args):
    from google.cloud import storage
    # Disable built-in metrics to avoid InvalidArgument missing instance_id errors on local runs
    spanner_client = spanner.Client(disable_builtin_metrics=True)
    instance = spanner_client.instance(args.instance)
    database = instance.database(args.database)
    
    # 📝 Split clients to avoid location conflicts (embeddings often not in global)
    client_text = genai.Client() # Default regional
    client_image = genai.Client(
        vertexai=settings.VERTEX_AI, 
        project=settings.PROJECT_ID if settings.PROJECT_ID else None, 
        location=settings.MODEL_LOCATION if settings.MODEL_LOCATION else None
    )
    
    logger.info(f"=== Seeding Database: {args.database} (Part: {args.part}) ===")
    
    products_batch = []
    stores_batch = []
    customers_batch = []
    inventory_batch = []
    user_sessions_batch = []
    payments_batch = []
    orders_batch = []
    order_items_batch = []

    from faker import Faker
    fakers = {
        "americas": Faker('en_US'),
        "europe": Faker('en_GB'),
        "asia": Faker('en_IN')
    }
    fake = Faker()

    # --- PART 1: Core Tables ---
    if args.part in ('1', 'all'):
        logger.info("--- Generating Part 1: Core Tables ---")
        
        # 1. Generate Products (AI enabled)
        logger.info(f"Generating {args.products} AI products and embeddings...")
        raw_products = generate_gemini_products(client_text, count=args.products)
        storage_client = storage.Client()
        bucket = storage_client.bucket(settings.GCS_BUCKET)
        
        for p in raw_products:
            p_id = str(uuid.uuid4())
            desc_emb = get_embeddings(client_text, text=p['description'])
            
            # 📸 Generate Image
            img_url = ""
            img_emb = [0.0] * 3072
            try:
                 prompt = f"A professional studio product shot of {p['name']}, high resolution, clean background"
                 logger.info(f"Generating image for {p['name']}...")
                 img_bytes = generate_image(client_image, prompt)
                 if img_bytes:
                      blob = bucket.blob(f"products/{p_id}.jpg")
                      blob.upload_from_string(img_bytes, content_type="image/jpeg")
                      img_url = f"https://storage.googleapis.com/{settings.GCS_BUCKET}/products/{p_id}.jpg"
                      logger.success(f"  Uploaded Image to GCS for {p['name']}")
                      if "text-embedding" in settings.EMBEDDING_MODEL:
                          img_emb = get_embeddings(client_text, text=prompt)
                      else:
                          img_emb = get_embeddings(client_text, image_bytes=img_bytes)
            except Exception as e:
                 logger.warning(f"Image generation failed for {p['name']}: {e}")

            products_batch.append((
                p_id, p['name'], p['description'], Decimal(str(p['price'])), p['category'],
                img_url, desc_emb, img_emb, datetime.utcnow()
            ))
            
        logger.info(f"Prepared {len(products_batch)} products.")

        # 2. Generate Stores & Customers
        stores_per_region = args.stores // len(PLACEMENT_REGIONS)
        customers_per_region = args.customers // len(PLACEMENT_REGIONS)
        
        for placement, hubs in PLACEMENT_REGIONS.items():
            logger.info(f"Generating data for placement area: {placement}...")
            # Generate Stores
            region_stores = []
            for _ in range(stores_per_region):
                hub = random.choice(hubs)
                # Scatter stores slightly around the hub (within ~10km)
                lat, lon = add_random_radius(hub["lat"], hub["lon"], max_km=10.0)
                store_id = str(uuid.uuid4())
                s2_id = get_s2_cell_id(lat, lon)
                fake_local = fakers.get(placement, fake)
                store_tuple = (
                    store_id, f"{fake_local.company()} {placement.title()} Hub",
                    lat, lon, s2_id, placement
                )
                stores_batch.append(store_tuple)
                region_stores.append(store_tuple)
            
            # Generate Customers
            for i in range(customers_per_region):
                is_fraud = i < (customers_per_region // 10)
                
                # Pick a random store in this region to be near
                store_lat, store_lon = 0.0, 0.0
                if region_stores:
                    store = random.choice(region_stores)
                    store_lat, store_lon = store[2], store[3]
                else:
                    hub = random.choice(hubs)
                    store_lat, store_lon = hub["lat"], hub["lon"]
                
                if is_fraud:
                    # Place fraud exactly 5km from the store consistently
                    lat, lon = add_random_radius(store_lat, store_lon, exact_km=5.0)
                else:
                    # Place legitimate customers 0-5km from the store
                    lat, lon = add_random_radius(store_lat, store_lon, max_km=5.0)
                    
                cust_id = str(uuid.uuid4())
                s2_id = get_s2_cell_id(lat, lon)

                fake_local = fakers.get(placement, fake)
                customers_batch.append((
                    cust_id, placement, fake_local.name(), 
                    f"fraud_test_{placement}_{i}@retail.net" if is_fraud else fake_local.email(),
                    lat, lon, s2_id, random.choice(['BRONZE', 'SILVER', 'GOLD']), random.randint(0, 5000)
                ))

        # 3. Generate Inventory (Region-specific product availability)
        logger.info(f"Generating Inventory with Regional Product Constraints...")
        
        # Assign a random subset (e.g., 60%) of all products to each region
        # This guarantees that filtering by region on the frontend yields different product sets
        products_by_region = {}
        for region in PLACEMENT_REGIONS.keys():
            products_by_region[region] = random.sample(products_batch, max(1, int(len(products_batch) * 0.6)))
            
        for s in stores_batch:
            placement = s[5]
            regional_products = products_by_region.get(placement, products_batch) # fallback to all
            
            # For each store, carry 80-100% of the region's products
            carry_count = int(len(regional_products) * random.uniform(0.8, 1.0))
            store_products = random.sample(regional_products, carry_count)
            
            for p in store_products:
                inventory_batch.append((
                    s[0], p[0], random.randint(10, 500), datetime.utcnow()
                ))

    # --- FETCH DATA FOR PART 2 (If run standalone) ---
    if args.part == '2':
        logger.info("--- Fetching existing data for Part 2 ---")
        try:
            with database.snapshot(multi_use=True) as snapshot:
                products_batch = [(r[0], r[3]) for r in list(snapshot.execute_sql("SELECT ProductId, Name, Description, Price FROM Products"))]
                stores_batch = [(r[0], r[5]) for r in list(snapshot.execute_sql("SELECT StoreId, StoreName, Latitude, Longitude, S2CellId, PlacementKey FROM Stores"))]
                customers_batch = [(r[0], r[1]) for r in list(snapshot.execute_sql("SELECT CustomerId, PlacementKey FROM Customers"))]
            logger.info(f"Fetched {len(products_batch)} products, {len(stores_batch)} stores, {len(customers_batch)} customers.")
        except Exception as e:
            logger.error(f"Failed to fetch data for Part 2: {e}. Ensure Part 1 was run first.")
            return

    # Normalize for Part 2 loops
    p_items = [(p[0], p[3]) for p in products_batch] if args.part in ('1', 'all') else products_batch
    s_items = [(s[0], s[5]) for s in stores_batch] if args.part in ('1', 'all') else stores_batch
    c_items = [(c[0], c[1]) for c in customers_batch] if args.part in ('1', 'all') else customers_batch

    # --- PART 2: Activity Tables ---
    if args.part in ('2', 'all') and c_items and s_items and p_items:
        logger.info("--- Generating Part 2: Activity Tables ---")
        
        # 1. User Sessions
        logger.info(f"Generating {args.sessions} UserSessions...")
        for _ in range(args.sessions):
            cust = random.choice(c_items)
            fake_local = fakers.get(cust[1], fake)
            user_sessions_batch.append((
                str(uuid.uuid4()), cust[0], None, datetime.utcnow(), fake_local.user_agent(), fake_local.ipv4()
            ))

        # 2. Payments
        logger.info(f"Generating Payments with realistic Fraud Clusters ...")
        # Generate exactly 10 fraud rings so the UI "Top 10" shows the full random variation
        num_fraud_sessions = min(10, len(user_sessions_batch))
        fraud_sessions = random.sample(user_sessions_batch, num_fraud_sessions)
        fraud_set = {s[0] for s in fraud_sessions}
        
        for session in user_sessions_batch:
            is_fraud = session[0] in fraud_set
            
            # Massive variance so sorting doesn't look artificially contiguous
            if is_fraud:
                # 50% chance of a massive ring (20-40), 50% chance of a medium ring (4-19)
                num_payments = random.randint(20, 40) if random.random() > 0.5 else random.randint(4, 19)
            else:
                num_payments = 1
            
            for _ in range(num_payments):
                payments_batch.append((
                    str(uuid.uuid4()), session[0], session[1], 
                    Decimal(f"{random.uniform(10.0, 500.0):.2f}"), 
                    f"card_token_{random.randint(1000, 9999)}", 
                    random.choice(['APPROVED', 'DECLINED']), datetime.utcnow()
                ))

        # 3. Orders
        logger.info(f"Generating {args.orders} Orders...")
        orders_map = {}
        for _ in range(args.orders):
            cust = random.choice(c_items)
            cust_id, placement = cust
            local_stores = [s for s in s_items if s[1] == placement]
            store_id = random.choice(local_stores)[0] if local_stores else random.choice(s_items)[0]
            order_id = str(uuid.uuid4())
            orders_batch.append((
                cust_id, order_id, store_id, datetime.utcnow(), random.choice(['PENDING', 'SHIPPED', 'DELIVERED'])
            ))
            orders_map[order_id] = (cust_id, 0)

        # 4. OrderItems
        logger.info(f"Generating {args.order_items} OrderItems...")
        if orders_batch:
            for _ in range(args.order_items):
                order = random.choice(orders_batch)
                order_id = order[1]
                cust_id = order[0]
                p = random.choice(p_items)
                orders_map[order_id] = (cust_id, orders_map[order_id][1] + 1)
                li_idx = orders_map[order_id][1]
                order_items_batch.append((
                    cust_id, order_id, li_idx, p[0], random.randint(1, 5), p[1]
                ))

    # --- APPLY BATCHES ---
    def batch_insert(table_name, columns, data_rows, chunk_size=2000):
         if not data_rows: return
         logger.info(f"Inserting {len(data_rows)} rows into {table_name}...")
         for i in range(0, len(data_rows), chunk_size):
             chunk = data_rows[i:i + chunk_size]
             with database.batch() as batch:
                  batch.insert(table=table_name, columns=columns, values=chunk)
         logger.success(f"Inserted into {table_name} successfully.")

    if args.part in ('1', 'all'):
        batch_insert("Products", ("ProductId", "Name", "Description", "Price", "Category", "ThumbnailUrl", "DescriptionEmbedding", "ImageEmbedding", "DateGenerated"), products_batch)
        batch_insert("Stores", ("StoreId", "StoreName", "Latitude", "Longitude", "S2CellId", "PlacementKey"), stores_batch)
        batch_insert("Customers", ("CustomerId", "PlacementKey", "FullName", "Email", "Latitude", "Longitude", "S2CellId", "LoyaltyTier", "LoyaltyPoints"), customers_batch)
        batch_insert("Inventory", ("StoreId", "ProductId", "StockCount", "LastUpdated"), inventory_batch)

    if args.part in ('2', 'all'):
        batch_insert("UserSessions", ("SessionId", "CustomerId", "ActiveCart", "LastEvent", "UserAgent", "IPAddress"), user_sessions_batch)
        batch_insert("Payments", ("PaymentId", "SessionId", "CustomerId", "Amount", "PaymentMethodToken", "Status", "CreatedAt"), payments_batch)
        batch_insert("Orders", ("CustomerId", "OrderId", "StoreId", "OrderDate", "Status"), orders_batch)
        batch_insert("OrderItems", ("CustomerId", "OrderId", "LineItemId", "ProductId", "Quantity", "Price"), order_items_batch)

    logger.info("=== Seeding Batches Complete ===")
    
    # 4. Verify Seed Results
    logger.info("\n📊 Verifying Seed Counts...")
    with database.snapshot(multi_use=True) as snapshot:
        tables = ['Products', 'Stores', 'Customers', 'Inventory', 'UserSessions', 'Payments', 'Orders', 'OrderItems']
        for table in tables:
            try:
                res = list(snapshot.execute_sql(f'SELECT COUNT(*) FROM {table}'))
                logger.info(f"  {table}: {res[0][0]}")
            except Exception as e:
                logger.error(f"  ❌ Error counting {table}: {e}")

    logger.info("\n=== Seeding Setup Complete ===")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Spanner database with synthetic data with Placements.")
    parser.add_argument("--instance", default="live-retail-geo", help="Spanner Instance ID")
    parser.add_argument("--database", default="spanner-demo-db", help="Spanner Database ID")
    parser.add_argument("--part", choices=['1', '2', 'all'], default='all', help="Part to load (1, 2, or all)")
    parser.add_argument("--products", type=int, default=30, help="Part 1: Products count")
    parser.add_argument("--stores", type=int, default=100, help="Part 1: Stores count")
    parser.add_argument("--customers", type=int, default=1000, help="Part 1: Customers count")
    parser.add_argument("--sessions", type=int, default=1000, help="Part 2: Sessions count")
    parser.add_argument("--payments", type=int, default=2000, help="Part 2: Payments count")
    parser.add_argument("--orders", type=int, default=2000, help="Part 2: Orders count")
    parser.add_argument("--order-items", type=int, default=4000, help="Part 2: Order items count")
    args = parser.parse_args()
    
    seed_data(args)
