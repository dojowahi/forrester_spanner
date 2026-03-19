import { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface Store {
  Name: string;
  City: string;
  Country: string;
}

export default function GeoView() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/stores/nearby?lat=37.7749&lon=-122.4194');
        const data = await res.json();
        setStores(data.nearby_stores || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4">Geospatial Capabilities</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-google-gray-200 shadow-sm rounded-xl p-6 h-[500px] overflow-y-auto">
          <div className="flex items-center gap-2 text-google-green text-sm font-semibold mb-4 pb-4 border-b border-google-gray-100">
            <MapPin className="w-5 h-5" />
            <span>Nearby Stores (San Francisco)</span>
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
                <div key={idx} className="p-3 bg-google-gray-50 rounded-lg border border-google-gray-200 hover:border-google-green transition-colors cursor-pointer">
                  <div className="font-medium text-google-gray-900">{store.Name}</div>
                  <div className="text-xs text-google-gray-800 mt-1">{store.City}, {store.Country}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-google-gray-100/50 rounded-xl h-[500px] flex flex-col items-center justify-center border border-google-gray-200 shadow-inner relative overflow-hidden">
          {/* Map Placeholder */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #34A853 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
          <div className="z-10 bg-white p-6 rounded-2xl shadow-lg border border-google-gray-200 text-center max-w-sm">
            <MapPin className="w-12 h-12 text-google-green mx-auto mb-3" />
            <h3 className="font-semibold text-google-gray-900 mb-2">Interactive Map Area</h3>
            <p className="text-sm text-google-gray-800">Spanner's native ST_DISTANCE functions quickly identify stores within a 50km radius of the user's coordinates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
