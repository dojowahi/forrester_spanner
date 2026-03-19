import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface Product {
  ProductId: string;
  Name: string;
  Price: number;
  Category: string;
}

export default function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/v1/search/hybrid?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        console.error('Search failed');
        setResults([]);
      }
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4">Unified Discovery</h1>
      <div className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-6">
        <form onSubmit={handleSearch} className="flex items-center gap-2 bg-google-gray-50 border border-google-gray-200 rounded-full px-4 py-2 w-full max-w-md mb-6 focus-within:border-google-blue focus-within:ring-1 focus-within:ring-google-blue transition-all">
          <Search className="w-5 h-5 text-google-gray-800" />
          <input
            type="text"
            placeholder="Search products, intent, or images..."
            className="bg-transparent border-none outline-none flex-1 text-sm text-google-gray-900"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="hidden">Search</button>
        </form>

        {loading ? (
          <div className="flex items-center justify-center p-8 text-google-gray-800">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : hasSearched && results.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((product) => (
              <div key={product.ProductId} className="p-4 bg-white border border-google-gray-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <div className="text-[10px] text-google-gray-800 uppercase tracking-widest font-semibold mb-1">{product.Category}</div>
                <h3 className="font-semibold text-google-gray-900">{product.Name}</h3>
                <div className="mt-2 text-google-blue font-medium">${product.Price}</div>
              </div>
            ))}
          </div>
        ) : hasSearched ? (
          <p className="text-google-gray-800 text-sm">No results found for "{query}".</p>
        ) : (
          <p className="text-google-gray-800 text-sm">Hybrid vector + full-text search results will render here.</p>
        )}
      </div>
    </div>
  );
}
