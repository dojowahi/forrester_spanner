from __future__ import annotations
from typing import Dict
from loguru import logger

class Args:
    """Mock args for seed_data"""
    def __init__(self, **kwargs):
        self.instance = kwargs.get("instance", "live-retail-geo")
        self.database = kwargs.get("database", "spanner-demo-db")
        self.part = kwargs.get("part", "all")
        self.products = kwargs.get("products", 2) # Small default for fast execution
        self.stores = kwargs.get("stores", 3)
        self.customers = kwargs.get("customers", 9)
        self.sessions = kwargs.get("sessions", 5)
        self.payments = kwargs.get("payments", 10)
        self.orders = kwargs.get("orders", 10)
        self.order_items = kwargs.get("order_items", 20)

def trigger_seed(params: dict = None) -> Dict:
    """Wrapper to trigger seed_demo.py logic"""
    import sys
    import os
    # Add project root to allow correct relative imports inside seed_demo
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))
    
    from backend.seed_demo import seed_data
    try:
        logger.info("Admin API triggering seed_data()...")
        args = Args(**(params or {}))
        seed_data(args)
        return {"success": True, "message": "Seeding completed successfully"}
    except Exception as e:
        logger.error(f"Seeding API trigger failed: {e}")
        return {"success": False, "message": str(e)}

def trigger_truncate() -> Dict:
    """Wrapper to trigger cleanup_demo.py logic"""
    import sys
    import os
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))
    
    from scripts.cleanup_demo import truncate_spanner_tables, cleanup_gcs_bucket
    instance_id = "live-retail-geo"
    database_id = "spanner-demo-db"
    bucket_name = "gen-ai-4all-live-retail-images"
    
    try:
        logger.info("Admin API triggering truncate_spanner_tables()...")
        truncate_spanner_tables(instance_id, database_id)
        cleanup_gcs_bucket(bucket_name)
        return {"success": True, "message": "Cleanup completed successfully"}
    except Exception as e:
        logger.error(f"Truncation API trigger failed: {e}")
        return {"success": False, "message": str(e)}
