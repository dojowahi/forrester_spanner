import argparse
from google.cloud import spanner
from google.cloud import storage
import urllib.parse

def cleanup_gcs_bucket(bucket_name):
    """Deletes all objects in the specified GCS bucket."""
    print(f"\n--- Cleaning up GCS Bucket: {bucket_name} ---")
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blobs = list(bucket.list_blobs())
        
        if not blobs:
            print("No objects found in bucket.")
            return

        print(f"Found {len(blobs)} objects. Deleting...")
        for blob in blobs:
            blob.delete()
            print(f"  Deleted {blob.name}")
        print("GCS Bucket cleanup complete.")
        
    except Exception as e:
        print(f"Warning/Error cleaning GCS bucket: {e}")

def truncate_spanner_tables(instance_id, database_id):
    """Truncates all tables in the specified Spanner database order-safe."""
    print(f"\n--- Truncating Spanner Tables: {database_id} ---")
    
    # Order matters safely for constraints (interleaved cascade deletes from parents)
    tables_to_delete = [
        "OrderItems",
        "Orders",
        "Payments",
        "UserSessions",
        "Inventory",
        "Customers",
        "Stores",
        "Products"
    ]
    
    try:
        spanner_client = spanner.Client(disable_builtin_metrics=True)
        instance = spanner_client.instance(instance_id)
        database = instance.database(database_id)
        
        # Delete without explicit batch context wrap to catch row-by-row/table-by-table commits safely
        for table in tables_to_delete:
            try:
                print(f"Truncating {table}...")
                # Delete requires explicit transaction or batch object
                database.execute_partitioned_dml(f"DELETE FROM {table} WHERE true")
                print(f"  Success: {table} truncated.")
            except Exception as e:
                print(f"  Warning: Failed to truncate {table}: {e}")
                
        print("Spanner Table Truncation complete.")
        
    except Exception as e:
        print(f"Error during Spanner truncation: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup Spanner tables and GCS bucket assets.")
    parser.add_argument("--instance", type=str, required=True, help="Spanner Instance ID")
    parser.add_argument("--database", type=str, required=True, help="Spanner Database ID")
    parser.add_argument("--bucket", type=str, default="gen-ai-4all-live-retail-images", help="GCS Bucket Name")
    
    args = parser.parse_args()
    
    # 1. Truncate Spanner
    truncate_spanner_tables(args.instance, args.database)
    
    # 2. Cleanup Bucket
    cleanup_gcs_bucket(args.bucket)
    
    print("\n=== Cleanup Operations Finished ===")
