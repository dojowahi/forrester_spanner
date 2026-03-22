import { useState } from 'react';
import { Play, Database, Loader2, AlertCircle } from 'lucide-react';

export default function SpannerPlaygroundView() {
  const [query, setQuery] = useState('SELECT * FROM Products LIMIT 10;');
  const [data, setData] = useState<{columns: string[], rows: any[], execution_time_ms?: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      const response = await fetch('/api/v1/debug/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });
      
      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during execution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto w-full flex flex-col h-[calc(100vh-80px)]">
      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4 flex items-center gap-2 shrink-0">
        <Database className="w-6 h-6 text-google-blue" />
        Spanner Playground
      </h1>
      
      <div className="flex flex-col gap-4 flex-1 overflow-hidden">
        {/* Editor Area */}
        <div className="bg-white border border-google-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col shrink-0">
          <div className="bg-google-gray-50 px-4 py-3 border-b border-google-gray-200 flex justify-between items-center">
            <h2 className="text-sm font-bold text-google-gray-800 uppercase tracking-wider">Editor</h2>
            <button 
              onClick={handleExecute}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 bg-google-blue hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Execute Query
            </button>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter SQL or GQL query here..."
            className="w-full h-48 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-0 text-google-gray-800"
            spellCheck={false}
          />
        </div>

        {/* Results Area */}
        <div className="bg-white border border-google-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col flex-1">
          <div className="bg-google-gray-50 px-4 py-3 border-b border-google-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-google-gray-800 uppercase tracking-wider">Results</h2>
            {data && data.execution_time_ms !== undefined && (
              <span className="text-xs font-semibold text-google-gray-600 bg-google-gray-200 px-2.5 py-1 rounded-full tracking-wide">
                {data.rows.length} rows • {data.execution_time_ms} ms
              </span>
            )}
          </div>
          
          <div className="overflow-auto flex-1 p-0">
            {error && (
              <div className="m-4 bg-red-50 text-google-red p-4 rounded-xl border border-red-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="font-mono text-sm">{error}</span>
              </div>
            )}
            
            {data && data.columns && (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-google-gray-50/95 backdrop-blur shadow-sm z-10">
                  <tr>
                    {data.columns.length > 0 ? (
                      data.columns.map((col) => (
                        <th key={col} className="px-6 py-3 border-b border-google-gray-200 text-xs font-bold text-google-gray-500 uppercase tracking-wider whitespace-nowrap bg-google-gray-50">
                          {col}
                        </th>
                      ))
                    ) : (
                      <th className="px-6 py-3 border-b border-google-gray-200 text-xs font-bold text-google-gray-500 bg-google-gray-50">No columns returned</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length > 0 ? (
                    data.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-google-gray-50/50 transition-colors">
                        {data.columns.map((col, i) => (
                          <td key={i} className="px-6 py-3 border-b border-google-gray-100 text-sm text-google-gray-700 whitespace-nowrap max-w-xs truncate" title={String(row[col])}>
                            {String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={Math.max(1, data.columns.length)} className="px-6 py-4 text-sm text-google-gray-500 italic text-center">
                        Query executed successfully. Query returned no results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            
            {!loading && !data && !error && (
              <div className="flex items-center justify-center p-12 text-google-gray-400">
                Run a query to see results here
              </div>
            )}
            {loading && !data && !error && (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-google-blue animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
