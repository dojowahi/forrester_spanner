import { useState, useEffect } from 'react';
import { AlertCircle, ThumbsUp, Loader2 } from 'lucide-react';

interface FraudCluster {
  s_SessionId: string;
  CardCount: number;
}

interface Recommendation {
  p_Name: string;
  PeerPurchaseCount: number;
}

export default function GraphView() {
  const [fraudClusters, setFraudClusters] = useState<FraudCluster[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fraudRes, recsRes] = await Promise.all([
          fetch('/api/v1/fraud/sessions'),
          fetch('/api/v1/customers/mock-cust-id/recommendations')
        ]);
        const fraudData = await fraudRes.json();
        const recsData = await recsRes.json();
        setFraudClusters(fraudData.fraud_clusters || []);
        setRecommendations(recsData.recommendations || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4">Customer Intelligence (Spanner Graph)</h1>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-google-blue animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Fraud Panel */}
          <div className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-semibold text-google-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-google-red" />
              Fraud Ring Detection
            </h2>
            <div className="space-y-4">
              {fraudClusters.length === 0 ? (
                <p className="text-sm text-google-gray-800">No fraud clusters detected.</p>
              ) : (
                fraudClusters.map((cluster, idx) => (
                  <div key={idx} className="p-4 border border-google-red/30 bg-google-red/5 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-google-gray-900">Session: {cluster.s_SessionId?.substring(0, 8)}...</div>
                      <div className="text-xs text-google-gray-800 mt-1">Found suspiciously sharing payment tokens.</div>
                    </div>
                    <div className="bg-google-red/10 text-google-red border border-google-red/30 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                      {cluster.CardCount} Cards Used
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recs Panel */}
          <div className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-semibold text-google-gray-900 mb-4 flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-google-blue" />
              Peer Recommendations
            </h2>
            <div className="space-y-3">
              {recommendations.length === 0 ? (
                <p className="text-sm text-google-gray-800">No peer recommendations found.</p>
              ) : (
                recommendations.map((rec, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 hover:bg-google-gray-50 rounded-lg transition-colors border border-google-gray-100">
                    <span className="font-medium text-google-gray-900">{rec.p_Name}</span>
                    <span className="text-[10px] text-google-gray-800 uppercase tracking-widest font-semibold bg-google-gray-100 px-2 py-1 rounded-md">
                      {rec.PeerPurchaseCount} peer buys
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
