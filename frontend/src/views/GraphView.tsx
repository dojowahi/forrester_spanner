import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, ThumbsUp, Loader2, X } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';

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
  const [fraudGraph, setFraudGraph] = useState<any>({ nodes: [], links: [] });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsGraph, setRecsGraph] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedGraph, setSelectedGraph] = useState<{ type: 'fraud' | 'recs', title: string, data: any } | null>(null);
  
  const [showSql, setShowSql] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

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
        // Make sure edges is renamed to links for react-force-graph
        setFraudGraph({
          nodes: fraudData.graph?.nodes || [],
          links: fraudData.graph?.edges || []
        });
        
        setRecommendations(recsData.recommendations || []);
        setRecsGraph({
          nodes: recsData.graph?.nodes || [],
          links: recsData.graph?.edges || []
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFraudClick = (cluster: FraudCluster) => {
    const sid = cluster.s_SessionId;
    const edges = fraudGraph.links.filter((l: any) => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return sId === sid || tId === sid;
    });
    const nodeIds = new Set(edges.flatMap((l: any) => [
        typeof l.source === 'object' ? l.source.id : l.source,
        typeof l.target === 'object' ? l.target.id : l.target
    ]));
    // Always include the session node
    nodeIds.add(sid);
    const nodes = fraudGraph.nodes.filter((n: any) => nodeIds.has(n.id));
    
    // Create new objects to prevent react-force-graph mutation issues
    setSelectedGraph({ 
        type: 'fraud', 
        title: `Fraud Ring: Session ${sid.substring(0, 8)}...`, 
        data: { 
            nodes: nodes.map((n:any) => ({...n})), 
            links: edges.map((l:any) => ({source: typeof l.source === 'object' ? l.source.id: l.source, target: typeof l.target === 'object' ? l.target.id: l.target})) 
        } 
    });
    setSelectedNode(null);
  };

  const handleRecClick = (rec: Recommendation) => {
    const pName = rec.p_Name;
    const edgesToP2 = recsGraph.links.filter((l: any) => {
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return tId === pName;
    });
    const peers = new Set(edgesToP2.map((l: any) => typeof l.source === 'object' ? l.source.id : l.source));
    
    const edgesToPeers = recsGraph.links.filter((l: any) => {
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return peers.has(tId);
    });
    const p1s = new Set(edgesToPeers.map((l: any) => typeof l.source === 'object' ? l.source.id : l.source));

    const edgesToP1s = recsGraph.links.filter((l: any) => {
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return p1s.has(tId);
    });

    const edges = [...edgesToP2, ...edgesToPeers, ...edgesToP1s];
    const nodeIds = new Set(edges.flatMap((l: any) => [
        typeof l.source === 'object' ? l.source.id : l.source,
        typeof l.target === 'object' ? l.target.id : l.target
    ]));
    // Include "You" node and the target product if not included
    nodeIds.add('You');
    nodeIds.add(pName);
    
    const nodes = recsGraph.nodes.filter((n: any) => nodeIds.has(n.id));

    setSelectedGraph({ 
        type: 'recs', 
        title: `Recommendation Graph: ${pName}`, 
        data: { 
            nodes: nodes.map((n:any) => ({...n})), 
            links: edges.map((l:any) => ({source: typeof l.source === 'object' ? l.source.id: l.source, target: typeof l.target === 'object' ? l.target.id: l.target})) 
        } 
    });
    setSelectedNode(null);
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(4, 2000); // 2 seconds zoom transition
    }
  }, []);

  const sqlQuery = `
-- FRAUD RING DETECTION:
-- Identifying multiple unique user sessions sharing the same payment method tokens
SELECT results.s_SessionId, results.PaymentMethodToken
FROM GRAPH_TABLE(
    RetailGraph
    MATCH (s:UserSessions)<-[e:AuthoredBy]-(p:Payments)
    COLUMNS (s.SessionId AS s_SessionId, p.PaymentMethodToken as PaymentMethodToken)
) AS results

-- PEER COLLABORATIVE RECOMMENDATIONS:
-- A -> B -> C: Finding products (P2) purchased by peers who also purchased the same initial products (P1) as the current customer
SELECT results.P1Name, results.PeerId, results.P2Name
FROM GRAPH_TABLE(
    RetailGraph
    MATCH (c1:Customers {CustomerId: @customer_id})-[:Purchased]->(p1:Products)<-[:Purchased]-(c2:Customers)-[:Purchased]->(p2:Products)
    WHERE p1.ProductId <> p2.ProductId AND c1.CustomerId <> c2.CustomerId
    COLUMNS (p1.Name AS P1Name, c2.CustomerId AS PeerId, p2.Name AS P2Name)
) AS results
`;

  return (
    <div className="p-6 relative">
      {/* Top action buttons */}
      <div className="absolute top-6 right-6 flex gap-2 z-10">
        <button onClick={() => setShowSql(true)} className="flex items-center gap-2 px-4 py-2 border border-google-gray-300 rounded-full text-sm font-bold text-google-gray-700 hover:bg-google-gray-50 hover:border-google-gray-400 shadow-sm transition-all bg-white cursor-pointer">
          <span>SQL</span>
        </button>
        <button onClick={() => setShowAbout(true)} className="flex items-center gap-2 px-4 py-2 bg-google-blue rounded-full text-sm font-bold text-white hover:bg-blue-700 shadow-sm transition-all cursor-pointer">
          <span>About</span>
        </button>
      </div>

      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4 pr-40">Customer Intelligence (Spanner Graph)</h1>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-google-blue animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Fraud Panel */}
          <div className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-google-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-google-red" />
              Fraud Ring Detection
            </h2>
            <div className="space-y-4 mb-6">
              {fraudClusters.length === 0 ? (
                <p className="text-sm text-google-gray-800">No fraud clusters detected.</p>
              ) : (
                fraudClusters.slice(0, 3).map((cluster, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 border border-google-red/30 bg-google-red/5 hover:bg-google-red/10 cursor-pointer rounded-xl flex items-center justify-between transition-colors"
                    onClick={() => handleFraudClick(cluster)}
                  >
                    <div>
                      <div className="text-sm font-medium text-google-gray-900">Session: {cluster.s_SessionId?.substring(0, 8)}...</div>
                      <div className="text-xs text-google-gray-800 mt-1">Found suspiciously sharing payment tokens.</div>
                    </div>
                    <div className="bg-google-red/10 text-google-red border border-google-red/30 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                      {cluster.CardCount} Cards
                    </div>
                  </div>
                ))
              )}
            </div>
            {fraudClusters.length > 0 && (
                <div className="text-xs text-google-gray-500 mt-auto text-center italic">
                    Click on a fraud ring to view the exact graph.
                </div>
            )}
          </div>

          {/* Recs Panel */}
          <div className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-google-gray-900 mb-4 flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-google-blue" />
              Peer Recommendations
            </h2>
            <div className="space-y-3 mb-6">
              {recommendations.length === 0 ? (
                <p className="text-sm text-google-gray-800">No peer recommendations found.</p>
              ) : (
                recommendations.slice(0,3).map((rec, idx) => (
                  <div 
                    key={idx} 
                    className="flex justify-between items-center p-3 hover:bg-google-gray-50 cursor-pointer rounded-lg transition-colors border border-google-gray-100"
                    onClick={() => handleRecClick(rec)}
                  >
                    <span className="font-medium text-google-gray-900">{rec.p_Name}</span>
                    <span className="text-[10px] text-google-gray-800 uppercase tracking-widest font-semibold bg-google-gray-100 px-2 py-1 rounded-md">
                      {rec.PeerPurchaseCount} peer buys
                    </span>
                  </div>
                ))
              )}
            </div>
            {recommendations.length > 0 && (
                <div className="text-xs text-google-gray-500 mt-auto text-center italic">
                    Click on a recommendation to view the exact graph.
                </div>
            )}
          </div>
        </div>
      )}

      {/* Graph Modal Overlay */}
      {selectedGraph && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-8 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full h-[80vh] max-w-5xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-google-gray-100 flex justify-between items-center bg-google-gray-50">
                    <h3 className="text-lg font-semibold text-google-gray-900">
                        {selectedGraph.title}
                    </h3>
                    <button 
                        onClick={() => setSelectedGraph(null)}
                        className="text-google-gray-500 hover:text-google-gray-900 p-1 rounded-full hover:bg-google-gray-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 relative bg-white">
                    <div className="absolute top-4 left-4 z-10 text-xs font-mono text-google-gray-600 bg-white/90 px-3 py-2 rounded-lg shadow-sm border border-google-gray-100">
                        {selectedGraph.type === 'fraud' ? (
                            <span>🔴 Session | ⚪ Card</span>
                        ) : (
                            <span>⭐ You | 🔵 Product | 👤 Peer | 🟩 Recommended</span>
                        )}
                    </div>
                    <div className="w-full h-full overflow-hidden">
                        {/* @ts-ignore */}
                        {selectedGraph.data.nodes.length > 0 && (
                        <ForceGraph2D
                            ref={graphRef}
                            width={window.innerWidth * 0.8}
                            height={window.innerHeight * 0.65}
                            graphData={selectedGraph.data}
                            nodeRelSize={6}
                            linkDirectionalParticles={2}
                            linkDirectionalParticleWidth={2}
                            linkDirectionalParticleSpeed={0.004}
                            linkWidth={1.5}
                            linkColor={() => '#e0e0e0'}
                            onNodeClick={handleNodeClick}
                            nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
                                const label = node.id;
                                
                                // Node Circle
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
                                
                                let fillColor = '#dadce0';
                                if (node.group === 'Session') fillColor = '#EA4335';
                                else if (node.group === 'Card') fillColor = '#dadce0';
                                else if (node.group === 'You') fillColor = '#F9AB00';
                                else if (node.group === 'Product') fillColor = '#4285F4';
                                else if (node.group === 'Peer') fillColor = '#9AA0A6';
                                else if (node.group === 'Recommended Product') fillColor = '#34A853';

                                ctx.fillStyle = fillColor;
                                ctx.fill();

                                // Selection Highlight Rectangle or Stroke
                                if (selectedNode && selectedNode.id === node.id) {
                                  ctx.strokeStyle = '#111';
                                  ctx.lineWidth = 2;
                                  ctx.stroke();
                                  
                                  // Subtle pulse ring
                                  ctx.beginPath();
                                  ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI, false);
                                  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                                  ctx.lineWidth = 4;
                                  ctx.stroke();
                                }

                                // Persistent Label (only visible when sufficiently zoomed)
                                if (globalScale > 1.2) {
                                  const fontSize = 11 / globalScale;
                                  ctx.font = `${fontSize}px Inter, sans-serif`;
                                  ctx.textAlign = 'center';
                                  ctx.textBaseline = 'middle';
                                  ctx.fillStyle = '#4a4a4a';
                                  // Truncate long strings for visualization
                                  const displayText = label.length > 25 ? label.substring(0, 22) + '...' : label;
                                  ctx.fillText(displayText, node.x, node.y + 14);
                                }
                            }}
                        />
                        )}
                    </div>
                </div>
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
                  <span className="font-mono font-black text-sm text-google-gray-700">GQL</span>
                </div>
                <h2 className="font-bold text-lg text-google-gray-900">Executed Spanner Graph Queries</h2>
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
              <h2 className="font-bold text-lg text-white">About Spanner Graph</h2>
              <button onClick={() => setShowAbout(false)} className="text-white/80 hover:text-white rounded-full hover:bg-white/10 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-google-gray-600 text-sm leading-relaxed bg-white">
              <p className="font-bold text-google-gray-900 text-base">Spanner Property Graph capability (GQL).</p>
              <p>
                This visual Force-Directed layout graphs relationship traversals natively querying composite transactional structures securely inside Cloud Spanner.
              </p>
              <div className="bg-google-gray-50 border border-google-gray-100 p-4 rounded-xl space-y-2">
                <p className="font-bold text-google-gray-800 text-xs uppercase">Spanner Features Used</p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  <li>**GQL Syntax (\`MATCH (c)-[e]-&gt;(p)\`)**: Spanner natively supports graph queries without requiring secondary database replication.</li>
                  <li>**Collaborative Filtering Patterns**: Traversing 4-hop path correlations securely inside Spanner.</li>
                </ul>
              </div>
              <p>
                This allows you to find fraud rings visually, while also performing recommendation computations without exporting data out of your transactional boundaries.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
