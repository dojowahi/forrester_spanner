from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner

def get_nearby_stores(database, lat: float, lon: float, radius_km: float = 50.0) -> List[Dict]:
    """
    Finds stores within a radius (in km) from a target Lat/Lon.
    Uses ST_DISTANCE(ST_GEOGPOINT, ST_GEOGPOINT) in Spanner.
    """
    radius_meters = radius_km * 1000.0
    
    radius_degrees = radius_km / 111.0 # Approximate degrees
    
    query = """
        SELECT StoreId, StoreName, Latitude, Longitude,
               SQRT(POWER(Latitude - @lat, 2) + POWER(Longitude - @lon, 2)) * 111.0 AS DistanceKm
        FROM Stores
        WHERE POWER(Latitude - @lat, 2) + POWER(Longitude - @lon, 2) < POWER(@radius_degrees, 2)
        ORDER BY DistanceKm ASC
        LIMIT 10
    """
    
    params = {
        "lat": lat,
        "lon": lon,
        "radius_degrees": radius_degrees
    }
    
    param_types = {
        "lat": spanner.param_types.FLOAT64,
        "lon": spanner.param_types.FLOAT64,
        "radius_degrees": spanner.param_types.FLOAT64
    }
    
    results = []
    try:
        with database.snapshot() as snapshot:
            print(f"Executing Geospatial proximity search around ({lat}, {lon}) inside {radius_km}km")
            rows = snapshot.execute_sql(query, params=params, param_types=param_types)
            for row in rows:
                results.append({
                    "StoreId": row[0],
                    "StoreName": row[1],
                    "Latitude": row[2],
                    "Longitude": row[3],
                    "DistanceMeters": float(row[4]) if row[4] is not None else 0.0
                })
    except Exception as e:
        print(f"Geospatial query failed: {e}")
        return []
        
    return results

def get_nearby_customers_for_store(database, store_id: str, radius_km: float = 500.0) -> Dict:
    """
    Finds customers within a radius (in km) from a specific store and groups by loyalty tie.
    """
    radius_degrees = radius_km / 111.0 # Approximate degrees
    
    query = """
        SELECT c.CustomerId, c.FullName, c.Email, c.LoyaltyTier, c.Latitude, c.Longitude,
               SQRT(POWER(c.Latitude - s.Latitude, 2) + POWER(c.Longitude - s.Longitude, 2)) * 111.0 AS DistanceKm
        FROM Customers c
        JOIN Stores s ON s.StoreId = @store_id
        WHERE POWER(c.Latitude - s.Latitude, 2) + POWER(c.Longitude - s.Longitude, 2) < POWER(@radius_degrees, 2)
        ORDER BY DistanceKm ASC
        LIMIT 50
    """
    
    query_grouped = """
        SELECT c.LoyaltyTier, COUNT(c.CustomerId) as MemberCount
        FROM Customers c
        JOIN Stores s ON s.StoreId = @store_id
        WHERE POWER(c.Latitude - s.Latitude, 2) + POWER(c.Longitude - s.Longitude, 2) < POWER(@radius_degrees, 2)
        GROUP BY c.LoyaltyTier
        ORDER BY MemberCount DESC
    """
    
    params = {
        "store_id": store_id,
        "radius_degrees": radius_degrees
    }
    
    param_types = {
        "store_id": spanner.param_types.STRING,
        "radius_degrees": spanner.param_types.FLOAT64
    }
    
    results = {"nearby_customers": [], "grouped_loyalty": []}
    try:
        with database.snapshot(multi_use=True) as snapshot:
            rows = snapshot.execute_sql(query, params=params, param_types=param_types)
            for row in rows:
                results["nearby_customers"].append({
                    "CustomerId": row[0],
                    "FullName": row[1],
                    "Email": row[2],
                    "LoyaltyTier": row[3],
                    "Latitude": row[4],
                    "Longitude": row[5],
                    "DistanceMeters": float(row[6]) * 1000.0 if row[6] is not None else 0.0
                })
            
            grouped_rows = snapshot.execute_sql(query_grouped, params=params, param_types=param_types)
            for row in grouped_rows:
                results["grouped_loyalty"].append({
                    "LoyaltyTier": row[0],
                    "MemberCount": row[1]
                })
    except Exception as e:
        print(f"Customer Proximity query failed: {e}")
        
    return results
