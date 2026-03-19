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
