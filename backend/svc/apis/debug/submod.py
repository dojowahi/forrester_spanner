from backend.svc.core.clients import database

def get_table_samples(db):
    tables = [
        "Customers", "Inventory", "OrderItems", "Orders", 
        "Payments", "Products", "Stores", "UserSessions"
    ]
    
    results = {}
    try:
        for table in tables:
            with db.snapshot() as snapshot:
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
