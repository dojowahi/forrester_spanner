import { useState, useEffect } from 'react';
import { Database, Loader2 } from 'lucide-react';

export default function DbDataView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/debug/tables')
      .then(res => res.json())
      .then(fetchedData => {
        setData(fetchedData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch tables", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 max-w-[1400px] mx-auto w-full">
      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4 flex items-center gap-2">
        <Database className="w-6 h-6 text-google-blue" />
        Database Overview
      </h1>
      
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-google-blue animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {data && Object.keys(data).filter(k => k !== 'error').map(tableName => (
            <div key={tableName} className="bg-white border border-google-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-google-gray-50 px-6 py-4 border-b border-google-gray-200">
                <h2 className="text-lg font-bold text-google-gray-800">{tableName}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-google-gray-50/50">
                      {data[tableName].length > 0 ? (
                        Object.keys(data[tableName][0]).map(col => (
                          <th key={col} className="px-6 py-3 border-b border-google-gray-100 text-xs font-bold text-google-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {col}
                          </th>
                        ))
                      ) : (
                        <th className="px-6 py-3 border-b border-google-gray-100 text-xs font-bold text-google-gray-500">No columns</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data[tableName].length > 0 ? (
                      data[tableName].map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-google-gray-50/50 transition-colors">
                          {Object.values(row).map((val: any, i: number) => (
                            <td key={i} className="px-6 py-3 border-b border-google-gray-100 text-sm text-google-gray-700 whitespace-nowrap max-w-xs truncate" title={String(val)}>
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-6 py-4 text-sm text-google-gray-500 italic text-center">Table is empty</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {data?.error && (
            <div className="bg-red-50 text-google-red p-4 rounded-xl border border-red-200">
              {data.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
