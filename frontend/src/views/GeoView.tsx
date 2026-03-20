import { useState, useEffect } from 'react';
import { Loader2, X, ArrowLeft, Target, Globe } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';

interface Store {
  StoreId: string;
  StoreName: string;
  Latitude: number;
  Longitude: number;
  DistanceMeters: number;
}

interface Customer {
  CustomerId: string;
  FullName: string;
  Email: string;
  LoyaltyTier: string;
  Latitude: number;
  Longitude: number;
  DistanceMeters: number;
}

function MapController({ center, zoom }: { center: {lat: number, lng: number}, zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.setCenter(center);
      map.setZoom(zoom);
    }
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

type HubKey = 'americas' | 'europe' | 'asia';
const HUBS = {
  americas: { name: 'Americas Hub', lat: 39.8283, lon: -98.5795 },
  europe: { name: 'Europe Hub', lat: 53.4808, lon: -2.2426 },     
  asia: { name: 'Asia Hub', lat: 20.5937, lon: 78.9629 }          
};

export default function GeoView() {
  const [activeHub, setActiveHub] = useState<HubKey>('americas');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSql, setShowSql] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [groupedLoyalty, setGroupedLoyalty] = useState<{LoyaltyTier: string, MemberCount: number}[]>([]);
  
  const sqlQuery = selectedStore ? `
-- SPANNER GEOSPATIAL PROXIMITY SEARCH:
-- Finding nearby Customers eligible for TARGETED promotions
-- TARGET STORE: ${selectedStore.StoreName}
SELECT c.CustomerId, c.FullName, c.Email, c.LoyaltyTier, c.Latitude, c.Longitude,
       SQRT(POWER(c.Latitude - s.Latitude, 2) + POWER(c.Longitude - s.Longitude, 2)) * 111.0 AS DistanceKm
FROM Customers c
JOIN Stores s ON s.StoreId = '${selectedStore.StoreId}'
WHERE POWER(c.Latitude - s.Latitude, 2) + POWER(c.Longitude - s.Longitude, 2) < POWER(5.0 / 111.0, 2)
ORDER BY DistanceKm ASC
LIMIT 50;

-- GEOSPATIAL AGGREGATION:
-- Grouping eligible members by their Loyalty Tiers
SELECT c.LoyaltyTier, COUNT(c.CustomerId) as MemberCount
FROM Customers c
JOIN Stores s ON s.StoreId = '${selectedStore.StoreId}'
WHERE POWER(c.Latitude - s.Latitude, 2) + POWER(c.Longitude - s.Longitude, 2) < POWER(5.0 / 111.0, 2)
GROUP BY c.LoyaltyTier
ORDER BY MemberCount DESC;
` : `
-- SPANNER GEOSPATIAL PROXIMITY SEARCH:
-- Finding nearby stores securely within the transactional boundaries
-- ACTIVE HUB REGION: ${HUBS[activeHub].name}
SELECT StoreId, StoreName, Latitude, Longitude,
       SQRT(POWER(Latitude - @lat, 2) + POWER(Longitude - @lon, 2)) * 111.0 AS DistanceKm
FROM Stores
WHERE POWER(Latitude - @lat, 2) + POWER(Longitude - @lon, 2) < POWER(@radius_degrees, 2)
  -- Application-level filtering applied on: StoreName LIKE '%${HUBS[activeHub].name}%'
ORDER BY DistanceKm ASC
LIMIT 50
`;

  useEffect(() => {
    const fetchStores = async () => {
      setLoading(true);
      try {
        const hub = HUBS[activeHub];
        const res = await fetch(`/api/v1/stores/nearby?lat=${hub.lat}&lon=${hub.lon}&radius_km=5000`);
        const data = await res.json();
        // Filter out extreme overlap
        const hubStores = (data.nearby_stores || []).filter((s: Store) => s.StoreName.includes(hub.name));
        setStores(hubStores);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, [activeHub]);

  const handleStoreClick = async (store: Store) => {
    setSelectedStore(store);
    setLoadingCustomers(true);
    setCustomers([]);
    try {
      const res = await fetch(`/api/v1/stores/${store.StoreId}/customers/nearby?radius_km=5`);
      const data = await res.json();
      setCustomers(data.nearby_customers || []);
      setGroupedLoyalty(data.grouped_loyalty || []);
    } catch(err) {
      console.error(err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  return (
    <div className="p-6 relative">
      {/* Top action buttons */}
      <div className="absolute top-6 right-6 flex gap-2 z-10">
        <button onClick={() => setShowSql(true)} className="flex items-center gap-2 px-4 py-2 border border-google-gray-300 rounded-full text-sm font-bold text-google-gray-700 hover:bg-google-gray-50 hover:border-google-gray-400 shadow-sm transition-all bg-white cursor-pointer">
          <span>SQL</span>
        </button>
        <button onClick={() => setShowAbout(true)} className="flex items-center gap-2 px-4 py-2 bg-google-green rounded-full text-sm font-bold text-white hover:bg-green-700 shadow-sm transition-all cursor-pointer">
          <span>About</span>
        </button>
      </div>

      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4 pr-40">Geospatial Capabilities</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-google-gray-200 shadow-sm rounded-xl p-6 h-[500px] overflow-y-auto flex flex-col">
          {!selectedStore ? (
            <>
              <div className="flex items-center gap-2 text-google-green text-sm font-semibold mb-3">
                <Globe className="w-5 h-5" />
                <span>Global Hub Regions</span>
              </div>
              <div className="flex gap-2 mb-4 pb-4 border-b border-google-gray-100 overflow-x-auto no-scrollbar">
                {(Object.keys(HUBS) as HubKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => { setActiveHub(key); setSelectedStore(null); setCustomers([]); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-colors cursor-pointer ${activeHub === key ? 'bg-google-green text-white' : 'bg-google-gray-100 text-google-gray-600 hover:bg-google-gray-200'}`}
                  >
                    {HUBS[key].name}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-google-green" />
                </div>
              ) : stores.length === 0 ? (
                <p className="text-sm text-google-gray-800">No stores found nearby.</p>
              ) : (
                <div className="space-y-3">
                  {stores.map((store, idx) => (
                    <div onClick={() => handleStoreClick(store)} key={idx} className="p-3 bg-google-gray-50 rounded-lg border border-google-gray-200 hover:border-google-green transition-colors cursor-pointer flex flex-col gap-1 shadow-sm hover:shadow">
                      <div className="font-medium text-google-gray-900 line-clamp-1">{store.StoreName}</div>
                      <div className="flex justify-between items-center text-xs text-google-gray-800">
                        <span>{store.Latitude.toFixed(2)}, {store.Longitude.toFixed(2)}</span>
                        <span className="font-semibold text-google-green">Select Target</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-google-gray-100">
                <button onClick={() => setSelectedStore(null)} className="flex items-center gap-1 text-sm text-google-gray-600 hover:text-google-gray-900 transition-colors cursor-pointer">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex items-center gap-2 text-google-blue text-sm font-semibold">
                  <Target className="w-4 h-4" />
                  <span>Promotional Targets</span>
                </div>
              </div>
              
              <div className="mb-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="font-bold text-google-gray-900 text-sm mb-1">{selectedStore.StoreName}</div>
                <div className="text-xs text-google-gray-700">Identifying high-value Loyalty members within 5km to blast targeted promotions.</div>
              </div>

              {loadingCustomers ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-google-blue" />
                </div>
              ) : customers.length === 0 ? (
                <p className="text-sm text-google-gray-800 text-center mt-4">No eligible customers found in this radius.</p>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-google-gray-500 uppercase tracking-wider mb-2">
                    <span>{customers.length} Customers Found</span>
                  </div>
                  {customers.map((cust, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-google-gray-200 flex flex-col gap-1 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-google-gray-900 text-sm">{cust.FullName}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cust.LoyaltyTier === 'GOLD' ? 'bg-yellow-100 text-yellow-800' : cust.LoyaltyTier === 'SILVER' ? 'bg-gray-200 text-gray-800' : 'bg-red-100 text-red-800'}`}>
                          {cust.LoyaltyTier}
                        </span>
                      </div>
                      <div className="text-xs text-google-gray-500">{cust.Email}</div>
                      <div className="text-xs text-google-gray-700 mt-2 flex justify-between">
                        <span>Distance:</span>
                        <span className="font-medium">{Math.round(cust.DistanceMeters / 1000)} km away</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-2 bg-google-gray-100/50 rounded-xl h-[500px] overflow-hidden border border-google-gray-200 shadow-inner relative">
          <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
            <Map
              defaultCenter={{ lat: HUBS.americas.lat, lng: HUBS.americas.lon }}
              defaultZoom={4}
              mapId="spanner-geo-map"
              disableDefaultUI={true}
              zoomControl={true}
            >
              {!selectedStore && (
                <MapController center={{ lat: HUBS[activeHub].lat, lng: HUBS[activeHub].lon }} zoom={4} />
              )}

              {selectedStore && (
                <MapController center={{ lat: selectedStore.Latitude, lng: selectedStore.Longitude }} zoom={6} />
              )}
              
              {!selectedStore && stores.map((store, idx) => (
                <AdvancedMarker onClick={() => handleStoreClick(store)} key={`store-${idx}`} position={{ lat: store.Latitude, lng: store.Longitude }}>
                  <Pin background={'#34A853'} borderColor={'#1E8E3E'} glyphColor={'#fff'} />
                </AdvancedMarker>
              ))}

              {selectedStore && (
                <AdvancedMarker position={{ lat: selectedStore.Latitude, lng: selectedStore.Longitude }}>
                  <Pin background={'#EA4335'} borderColor={'#B31412'} glyphColor={'#fff'} scale={1.2} />
                </AdvancedMarker>
              )}

              {selectedStore && customers.map((cust, idx) => (
                <AdvancedMarker key={`cust-${idx}`} position={{ lat: cust.Latitude, lng: cust.Longitude }}>
                  <Pin background={cust.LoyaltyTier === 'GOLD' ? '#FBBC04' : '#4285F4'} borderColor={'#fff'} glyphColor={'#fff'} scale={0.8} />
                </AdvancedMarker>
              ))}
            </Map>
          </APIProvider>
        </div>
      </div>

      {/* Grouped Loyalty Bottom Panel */}
      {selectedStore && groupedLoyalty.length > 0 && (
        <div className="mt-6 bg-white border border-google-gray-200 shadow-sm rounded-xl p-6">
          <h2 className="text-lg font-semibold text-google-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-google-green" />
            Loyalty Tier Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {groupedLoyalty.map((group, idx) => (
              <div key={idx} className="bg-google-gray-50 border border-google-gray-100 rounded-lg p-4 flex justify-between items-center">
                <span className={`font-bold text-sm px-3 py-1 rounded-full ${group.LoyaltyTier === 'GOLD' ? 'bg-yellow-100 text-yellow-800' : group.LoyaltyTier === 'SILVER' ? 'bg-gray-200 text-gray-800' : group.LoyaltyTier === 'BRONZE' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                  {group.LoyaltyTier}
                </span>
                <span className="text-2xl font-black text-google-gray-900">{group.MemberCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SQL Modal */}
      {showSql && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden border border-google-gray-200">
            <div className="p-6 border-b border-google-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-google-gray-100 flex items-center justify-center">
                  <span className="font-mono font-black text-sm text-google-gray-700">SQL</span>
                </div>
                <h2 className="font-bold text-lg text-google-gray-900">Executed Spanner Query</h2>
              </div>
              <button onClick={() => setShowSql(false)} className="text-google-gray-400 hover:text-google-gray-600 rounded-full hover:bg-google-gray-100 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-google-gray-900 text-google-gray-100 font-mono text-xs leading-relaxed flex-1">
              <pre className="whitespace-pre-wrap">{sqlQuery}</pre>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden border border-google-gray-200">
            <div className="p-6 border-b border-google-gray-100 flex items-center justify-between bg-google-green">
              <h2 className="font-bold text-lg text-white">About Geospatial Search</h2>
              <button onClick={() => setShowAbout(false)} className="text-white/80 hover:text-white rounded-full hover:bg-white/10 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-google-gray-600 text-sm leading-relaxed bg-white">
              <p className="font-bold text-google-gray-900 text-base">Spanner Geospatial & Proximity Capabilities</p>
              <p>
                This module demonstrates Cloud Spanner's ability to natively execute lightning-fast geospatial math without extracting data to a separate GIS service.
              </p>
              <div className="bg-google-gray-50 border border-google-gray-100 p-4 rounded-xl space-y-3">
                <p className="font-bold text-google-gray-800 text-xs uppercase">Key Features & Patterns</p>
                <ul className="list-disc pl-4 space-y-2 text-xs">
                  <li><strong>Native Distance Math:</strong> The query rapidly processes Pythagorean approximations `POWER(Lat1-Lat2, 2) + POWER(Lon1-Lon2, 2)` directly in the `WHERE` clause to filter out-of-range rows.</li>
                  <li><strong>Cross-Entity Proximity:</strong> By running a fast `JOIN` between <code className="bg-google-gray-200 px-1 rounded text-[10px]">Stores</code> and <code className="bg-google-gray-200 px-1 rounded text-[10px]">Customers</code>, the backend pinpoints eligible loyalty members within a strict 5km promotional radius.</li>
                  <li><strong>Geospatial Aggregation:</strong> Demonstrates Spanner natively performing a complex `GROUP BY` reduction purely based on members residing inside the math-computed bounding radius, showing real-time tiered counts.</li>
                  <li><strong>Global Regions:</strong> Hub filtering seamlessly re-queries the entire Americas, Europe, or Asia dataset to locate central supply stores locally.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
