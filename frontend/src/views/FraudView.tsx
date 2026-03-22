import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';

interface FraudCluster {
  s_SessionId: string;
  CardCount: number;
}

export default function FraudView() {
  const [fraudClusters, setFraudClusters] = useState<FraudCluster[]>([]);
  const [fraudGraph, setFraudGraph] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedGraph, setSelectedGraph] = useState<{ type: 'fraud', title: string, data: any } | null>(null);
  
  const [showSql, setShowSql] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fraudRes = await fetch('/api/v1/fraud/sessions');
        const fraudData = await fraudRes.json();
        
        setFraudClusters(fraudData.fraud_clusters || []);
        // Make sure edges is renamed to links for react-force-graph
        setFraudGraph({
          nodes: fraudData.graph?.nodes || [],
          links: fraudData.graph?.edges || []
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

      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4 pr-40">Fraud Ring Detection</h1>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-google-blue animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-google-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-google-red" />
            Detected Anomalies
          </h2>
          <div className="space-y-4 mb-6">
            {fraudClusters.length === 0 ? (
              <p className="text-sm text-google-gray-800">No fraud clusters detected.</p>
            ) : (
              fraudClusters.map((cluster, idx) => (
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
                  Click on a fraud ring to view the exact graph connecting sessions by identical cards.
              </div>
          )}
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
                        <span>🔴 Session | ⚪ Card</span>
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

                                ctx.fillStyle = fillColor;
                                ctx.fill();

                                // Selection Highlight
                                if (selectedNode && selectedNode.id === node.id) {
                                  ctx.strokeStyle = '#111';
                                  ctx.lineWidth = 2;
                                  ctx.stroke();
                                  
                                  ctx.beginPath();
                                  ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI, false);
                                  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                                  ctx.lineWidth = 4;
                                  ctx.stroke();
                                }

                                if (globalScale > 1.2) {
                                  const fontSize = 11 / globalScale;
                                  ctx.font = `${fontSize}px Inter, sans-serif`;
                                  ctx.textAlign = 'center';
                                  ctx.textBaseline = 'middle';
                                  ctx.fillStyle = '#4a4a4a';
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
                <h2 className="font-bold text-lg text-google-gray-900">Executed Spanner Graph Query</h2>
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
              <h2 className="font-bold text-lg text-white">About Fraud Detection via Graph</h2>
              <button onClick={() => setShowAbout(false)} className="text-white/80 hover:text-white rounded-full hover:bg-white/10 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-google-gray-600 text-sm leading-relaxed bg-white">
              <p className="font-bold text-google-gray-900 text-base">Spanner Property Graph capability (GQL).</p>
              <p>
                This module uses GQL syntax (<code>MATCH (s)-[e]-&gt;(p)</code>) to natively traverse transactional connections inside Spanner without secondary replicated DBs.
              </p>
              <p>
                Fraud rings are detected implicitly when multiple unique user sessions authenticate and share exactly the same payment tokens.
              </p>
              <div className="bg-google-gray-50 p-4 rounded-lg border border-google-gray-200 mt-2">
                <p className="font-bold text-google-gray-900 mb-1">What am I looking at?</p>
                <p>
                  The interactive graph visualizes <strong>User Sessions (🔴)</strong> connected to underlying <strong>Payment Cards (⚪)</strong>. When you see a single session suddenly fanning out to numerous different payment cards (a hub-and-spoke cluster), it visually exposes a &quot;fraud ring&quot; in action—typically indicating a bad actor rapidly testing blocks of stolen credit card numbers against your checkout system without needing any complex machine learning!
                </p>
                <p className="font-bold text-google-gray-900 mt-4 mb-1">How was this detected?</p>
                <p>
                  Spanner executed a real-time Graph traversal (<code>MATCH</code>) over the live operational tables (<code>UserSessions</code> and <code>Payments</code>). Instead of exporting data to a separate Graph database or running an overnight batch job, this visualization is instantly powered by querying the exact same unified Spanner database handling the live shopping carts!
                </p>
                <p className="font-bold text-google-gray-900 mt-4 mb-1">Is this Geo-Partitioned?</p>
                <p>
                  <strong>No, by design!</strong> While the storefront filters by your selected region, Fraud Rings operate globally. The <code>UserSessions</code> and <code>Payments</code> tables do not have a <code>PlacementKey</code>. This allows Spanner to effortlessly traverse the <strong>entire unified global dataset</strong> in a single operational query to find cross-region attackers, all without moving data to an analytical warehouse!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
