from backend.svc.core.clients import database

def get_table_samples(db, geo: str = "global"):
    tables = [
        "Customers", "Inventory", "OrderItems", "Orders", 
        "Payments", "Products", "Stores", "UserSessions"
    ]
    
    results = {}
    try:
        from google.cloud import spanner
        for table in tables:
            with db.snapshot() as snapshot:
                if geo != "global" and table in ["Stores", "Customers"]:
                    query = f"SELECT * FROM {table} WHERE PlacementKey = @geo LIMIT 5"
                    rows = snapshot.execute_sql(query, params={"geo": geo}, param_types={"geo": spanner.param_types.STRING})
                else:
                    rows = snapshot.execute_sql(f"SELECT * FROM {table} LIMIT 5")
                
                fetched_rows = list(rows)
                cols = [field.name for field in rows.fields]
                table_data = []
                for row in fetched_rows:
                    row_dict = {}
                    for i, col in enumerate(cols):
                        val = row[i]
                        row_dict[col] = str(val) if val is not None else None
                    table_data.append(row_dict)
                results[table] = table_data
    except Exception as e:
        print(f"Error fetching table samples: {e}")
        return {"error": str(e)}
        
    return results

def execute_raw_query(db, query: str):
    import time
    try:
        start_time = time.time()
        with db.snapshot() as snapshot:
            rows = snapshot.execute_sql(query)
            fetched_rows = list(rows)
            cols = [field.name for field in rows.fields]
            
            table_data = []
            for row in fetched_rows:
                row_dict = {}
                for i, col in enumerate(cols):
                    val = row[i]
                    row_dict[col] = str(val) if val is not None else None
                table_data.append(row_dict)
                
            end_time = time.time()
            return {
                "columns": cols, 
                "rows": table_data,
                "execution_time_ms": round((end_time - start_time) * 1000, 2)
            }
    except Exception as e:
        print(f"Error executing raw query: {e}")
        return {"error": str(e)}
