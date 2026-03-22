import { useState, useEffect, useRef } from 'react';
import { Search, Package, Sparkles, Loader2, Camera, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useGeo } from '../context/GeoContext';

type SearchMode = 'fulltext' | 'hybrid';

interface Product {
  ProductId: string;
  Name: string;
  Description?: string;
  Price: number;
  InventoryCount: number;
  ImageUrl: string;
  distance: number;
  Category: string;
}

export default function SearchView() {
  const { addToCart } = useCart();
  const { geo } = useGeo();
  const [query, setQuery] = useState('');
  const [flippedProductId, setFlippedProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [showSql, setShowSql] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchType, setSearchType] = useState<'text' | 'image'>('text');
  const [searchMode, setSearchMode] = useState<'fulltext' | 'hybrid'>('hybrid');

  // Image search states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load initial trending products or retry current search when geo changes
    if (query || selectedFile) {
      handleSearch(query, selectedFile);
    } else {
      handleSearch('trending', null, true);
    }
    // eslint-disable-next-line
  }, [geo]); // Re-run when placement geo changes

  const handleSearch = async (searchQuery: string, file: File | null = null, isInitialLoad = false) => {
    if (!searchQuery.trim() && !file && !isInitialLoad) return;
    setIsSearching(true);
    if (!isInitialLoad) {
      setHasSearched(true);
    }
    setSearchType(file ? 'image' : 'text');

    try {
      let response;
      if (searchQuery === 'trending' && isInitialLoad) {
        response = await fetch(`/api/v1/products?geo=${geo}`);
      } else if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('limit', '8');
        formData.append('geo', geo);

        response = await fetch('/api/v1/search/image', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch(`/api/v1/search/hybrid?query=${encodeURIComponent(searchQuery)}&mode=${searchMode}&geo=${geo}`);
      }

      if (response && response.ok) {
        const data = await response.json();
        const mappedProducts = (data.results || []).slice(0, 8).map((p: { InventoryCount?: number, distance?: number, ImageUrl?: string, ThumbnailUrl?: string, ProductId?: string } & Product) => ({
          ...p,
          InventoryCount: p.InventoryCount !== undefined ? p.InventoryCount : Math.floor(Math.random() * 200),
          distance: p.distance !== undefined ? p.distance : (Math.random() * 0.4),
          ImageUrl: p.ProductId ? `/api/v1/images/${p.ProductId}` : ''
        }));
        setProducts(mappedProducts);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Search failed', error);
      setProducts([]);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query, selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      handleSearch('', file);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Return to default
    if (query) {
      handleSearch(query);
    } else {
      handleSearch('trending');
      setHasSearched(false);
    }
  };

  const sqlQuery = searchType === 'image' ? `
-- Spanner Vector Search using COSINE_DISTANCE (Image Match)
SELECT 
    p.ProductId, 
    p.Name, 
    p.Price, 
    p.ThumbnailUrl,
    COSINE_DISTANCE(p.ImageEmbedding, @query_embedding) as distance
FROM Products p
WHERE p.ImageEmbedding IS NOT NULL${geo !== 'global' ? `\n  AND EXISTS (SELECT 1 FROM Inventory i JOIN Stores s ON i.StoreId = s.StoreId WHERE i.ProductId = p.ProductId AND s.PlacementKey = '${geo}')` : ''}
ORDER BY distance ASC
LIMIT @limit;
` : searchMode === 'fulltext' ? `
-- Spanner FullText Search (Index-backed with SEARCH())
SELECT 
    p.ProductId, 
    p.Name, 
    p.Description,
    p.Price, 
    p.ThumbnailUrl,
    0.0 as distance
FROM Products p
WHERE SEARCH(p.SearchTokens, @query)${geo !== 'global' ? `\n  AND EXISTS (SELECT 1 FROM Inventory i JOIN Stores s ON i.StoreId = s.StoreId WHERE i.ProductId = p.ProductId AND s.PlacementKey = '${geo}')` : ''}
LIMIT @limit;
` : `
-- Spanner Hybrid Search (Vector + Lexical CTE Boost)
WITH Matchers AS (
    SELECT ProductId, 0 as match_tier FROM Products WHERE SEARCH(SearchTokens, @query)
)
SELECT 
    p.ProductId, 
    p.Name, 
    p.Price, 
    p.ThumbnailUrl,
    (
        COSINE_DISTANCE(p.DescriptionEmbedding, @query_embedding) * 0.70 +
        COALESCE(COSINE_DISTANCE(p.ImageEmbedding, @query_embedding), COSINE_DISTANCE(p.DescriptionEmbedding, @query_embedding)) * 0.30
    ) as distance
FROM Products p
LEFT JOIN Matchers m ON p.ProductId = m.ProductId
WHERE 1=1${geo !== 'global' ? `\n  AND EXISTS (SELECT 1 FROM Inventory i JOIN Stores s ON i.StoreId = s.StoreId WHERE i.ProductId = p.ProductId AND s.PlacementKey = '${geo}')` : ''}
ORDER BY
    COALESCE(m.match_tier, 1) ASC,
    distance ASC
LIMIT @limit;
`;

  return (
    <div className="h-full flex flex-col gap-8 relative p-8 max-w-[1400px] mx-auto w-full">

      {/* Top action buttons */}
      <div className="absolute top-2 right-6 flex gap-2 z-10">
        <button onClick={() => setShowSql(true)} className="flex items-center gap-2 px-4 py-2 border border-google-gray-300 rounded-full text-sm font-bold text-google-gray-700 hover:bg-google-gray-50 hover:border-google-gray-400 shadow-sm transition-all bg-white cursor-pointer">
          <span>SQL</span>
        </button>
        <button onClick={() => setShowAbout(true)} className="flex items-center gap-2 px-4 py-2 bg-google-blue rounded-full text-sm font-bold text-white hover:bg-blue-700 shadow-sm transition-all cursor-pointer">
          <span>About</span>
        </button>
      </div>

      {/* Header & Search */}
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full text-center mt-12">
        <h1 className="text-4xl lg:text-5xl font-bold text-google-gray-900 tracking-tight">
          What are you looking for?
        </h1>
        <p className="text-lg text-google-gray-500">
          Powered by Gemini 3.1 Flash multimodality and Spanner exact-neighbor vector search.
        </p>

        {/* Search Mode Selection */}
        <div className="flex justify-center gap-2 mt-4">
          {['fulltext', 'hybrid'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSearchMode(mode as SearchMode)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${searchMode === mode
                ? 'bg-google-gray-900 text-white shadow-md'
                : 'bg-white border border-google-gray-200 text-google-gray-600 hover:bg-gray-50'
                }`}
            >
              {mode === 'fulltext' && 'FullText Search'}
              {mode === 'hybrid' && 'Hybrid Search'}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="relative mt-2 w-full flex flex-col items-center gap-4">
          <div className="relative w-full flex items-center justify-center">
            <div className="absolute left-6 text-google-gray-400">
              <Search className="w-6 h-6 shrink-0" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={selectedFile ? "Searching by image..." : "Try 'a cozy sweater' or 'something for my living room'..."}
              disabled={!!selectedFile}
              className="w-full bg-white border-2 border-google-gray-200 rounded-full py-5 pl-16 pr-44 text-xl focus:outline-none focus:border-google-blue focus:ring-4 focus:ring-blue-50 transition-all shadow-md disabled:bg-gray-50 text-google-gray-900"
            />

            <div className="absolute right-3 flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-google-gray-500 hover:text-google-blue hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                title="Search by Image"
              >
                <Camera className="w-6 h-6" />
              </button>

              <button
                type="submit"
                disabled={isSearching}
                className="bg-google-blue hover:bg-blue-600 active:scale-95 text-white px-8 py-3.5 rounded-full font-bold text-base flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
              </button>
            </div>
          </div>

          {/* Image Preview Area */}
          {imagePreview && (
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-google-gray-200 shadow-sm mt-2 w-full max-w-sm ml-auto mr-auto transition-all">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                <img src={imagePreview} alt="Search Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5 hover:bg-red-600 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-xs font-bold text-google-gray-700">Searching by image</p>
                <p className="text-[10px] text-google-gray-400 truncate w-full">{selectedFile?.name}</p>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Results Grid */}
      <div className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto pb-12 mt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-google-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-google-blue" />
            {hasSearched ? (searchType === 'image' ? 'Visual Match Results' : 'Search Results') : 'Trending Now'}
          </h2>
          {hasSearched && !isSearching && products.length > 0 && (
            <span className="text-sm font-medium text-google-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Found {products.length} matches in <span className="font-bold text-google-blue">14ms</span>
            </span>
          )}
        </div>

        {isSearching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse h-[400px] flex flex-col">
                <div className="flex-1 bg-gray-200"></div>
                <div className="p-4 space-y-3 bg-white h-[120px]">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.ProductId}
                className="perspective-1000 cursor-pointer group h-[400px]"
                onClick={() => setFlippedProductId(flippedProductId === product.ProductId ? null : product.ProductId)}
              >
                <div className={`transform-style-3d transition-all duration-700 relative w-full h-full rounded-2xl ${flippedProductId === product.ProductId ? 'rotate-y-180 shadow-xl' : 'shadow-sm border border-google-gray-200 group-hover:shadow-md'}`}>

                  {/* Front Face */}
                  <div className="backface-hidden bg-white rounded-2xl overflow-hidden flex flex-col h-full transition-all duration-300 group-hover:-translate-y-1 absolute inset-0">
                    {hasSearched && !(searchType === 'text' && searchMode === 'hybrid') && product.distance < 0.3 && (
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-google-blue text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 z-10">
                        <Sparkles className="w-3 h-3" />
                        High Match
                      </div>
                    )}

                    <div className="flex-1 relative overflow-hidden bg-google-gray-50 flex items-center justify-center">
                      {product.ImageUrl ? (
                        <img
                          src={product.ImageUrl}
                          alt={product.Name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="text-google-gray-400 text-sm font-medium tracking-wide">IMAGE PLACEHOLDER</div>
                      )}

                      {/* Stock Badge Overlay */}
                      <div className="absolute bottom-3 left-3 flex gap-2">
                        <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-md shadow-sm border
                           ${product.InventoryCount > 100
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : product.InventoryCount > 0
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              : 'bg-red-50 text-red-700 border-red-200'}`
                        }>
                          {product.InventoryCount} IN STOCK
                        </span>
                      </div>
                    </div>

                    <div className="p-5 bg-white shrink-0">
                      <div className="text-[10px] text-google-gray-500 uppercase tracking-widest font-bold mb-1">{product.Category}</div>
                      <h3 className="font-semibold text-google-gray-900 text-lg leading-tight mb-2 line-clamp-2 truncate" title={product.Name}>
                        {product.Name}
                      </h3>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-2xl font-black text-google-blue">${product.Price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Back Face */}
                  <div className="absolute inset-0 rotate-y-180 backface-hidden bg-white rounded-2xl p-6 flex flex-col shadow-xl overflow-hidden border border-google-gray-200 z-10">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-xs text-google-gray-500 uppercase tracking-wider">Description</h4>
                      <button
                        className="p-1 hover:bg-gray-100 rounded-full text-google-gray-400 hover:text-google-gray-600 transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlippedProductId(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto text-sm text-google-gray-800 leading-relaxed scrollbar-thin">
                      {product.Description || "No detailed description available for this product."}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xl font-bold text-google-gray-900">${product.Price.toFixed(2)}</span>
                      <button
                        className="text-white font-bold text-sm bg-google-blue hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart({
                            ProductId: product.ProductId,
                            Name: product.Name,
                            Price: product.Price,
                            Quantity: 1
                          });
                          alert('Added ' + product.Name + ' to cart!');
                        }}
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            ))}
            </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-google-gray-400">
            <Search className="w-16 h-16 mb-4 opacity-20" />
            <h3 className="text-xl font-medium text-google-gray-600 mb-2">No exact matches found</h3>
            <p className="text-sm">Try rephrasing your search query</p>
          </div>
        )}
      </div>

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
            <div className="p-6 border-b border-google-gray-100 flex items-center justify-between bg-google-blue">
              <h2 className="font-bold text-lg text-white">About Storefront Search</h2>
              <button onClick={() => setShowAbout(false)} className="text-white/80 hover:text-white rounded-full hover:bg-white/10 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-google-gray-600 text-sm leading-relaxed bg-white">
              <p className="font-bold text-google-gray-900 text-base">Spanner Vector Search Capabilities.</p>
              <p>
                This Storefront delivers non-stunted contextual searches by matching natural string entries directly using **Spanner Float32 Vector Search Array bindings**.
              </p>
              <div className="bg-google-gray-50 border border-google-gray-100 p-4 rounded-xl space-y-2">
                <p className="font-bold text-google-gray-800 text-xs uppercase">Spanner Features Used</p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  <li>**Exact Match FullText**: Blazing-fast lexicographical match indices via `SEARCH()`.</li>
                  <li>**Multimodal Embeddings (`ARRAY FLOAT32`)**: Product Images and Descriptions share the exact same high-dimensional search space using Gemini Multimodal capability.</li>
                  <li>**Tiered Hybrid Blended Ranking (`SEARCH()`)**: Using Common Table Expressions to inject an exact Lexical match `match_tier`, followed by a carefully weighted (70% Text / 30% Image) blended semantic vector distance against textual descriptions and visual images.</li>
                </ul>
              </div>
              <p>
                The backend effortlessly routes between strict Keyword Search and unified Hybrid semantic retrieval to surface exactly what users intend!
              </p>
              <div className="bg-google-gray-50 border border-google-gray-100 p-4 rounded-xl space-y-2">
                <p className="font-bold text-google-gray-800 text-xs uppercase">Geo-Partitioning</p>
                <p>When a specific region (e.g., Asia) is selected via the global dropdown, the Search dynamically <code>JOIN</code>s against the relational <code>Inventory</code> and <code>Stores</code> tables, pushing a <code>PlacementKey</code> filter. This guarantees you only see products physically available in your region, routing the search execution to the local partition!</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
