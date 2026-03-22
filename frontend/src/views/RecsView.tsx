import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, X, Share2 } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { useGeo } from '../context/GeoContext';

interface Recommendation {
  p_Name: string;
  PeerPurchaseCount: number;
}

export default function RecsView() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsGraph, setRecsGraph] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedGraph, setSelectedGraph] = useState<{ title: string, data: any, analysisText: React.ReactNode } | null>(null);
  
  const { geo } = useGeo();
  
  const [showSql, setShowSql] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const recsRes = await fetch(`/api/v1/customers/mock-cust-id/recommendations?geo=${geo}`);
        const recsData = await recsRes.json();
        
        setRecommendations(recsData.recommendations || []);
        // Make sure edges is renamed to links for react-force-graph
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
  }, [geo]);

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

    // Construct exactly how it was found
    const analysisText = (
       <span>
        This product is recommended because <strong>{peers.size}</strong> peer(s) who bought product(s) you already own (<strong>{Array.from(p1s).join(', ')}</strong>) went on to purchase <strong>{pName}</strong>. 
        <br/><br/>
        This matches collaborative filtering dependencies efficiently directly inside Spanner.
       </span>
    );

    setSelectedGraph({ 
        title: `Recommendation Graph: ${pName}`, 
        data: { 
            nodes: nodes.map((n:any) => ({...n})), 
            links: edges.map((l:any) => ({source: typeof l.source === 'object' ? l.source.id: l.source, target: typeof l.target === 'object' ? l.target.id: l.target})) 
        },
        analysisText
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
-- PEER COLLABORATIVE RECOMMENDATIONS:
-- A -> B -> C: Finding products (P2) purchased by peers who also purchased the same initial products (P1) as the current customer
SELECT results.P1Name, results.PeerId, results.P2Name
FROM GRAPH_TABLE(
    RetailGraph
    MATCH (c1:Customers {CustomerId: @customer_id})-[:Purchased]->(p1:Products)<-[:Purchased]-(c2:Customers)-[:Purchased]->(p2:Products)
    WHERE p1.ProductId <> p2.ProductId AND c1.CustomerId <> c2.CustomerId
    COLUMNS (p1.Name AS P1Name, c2.CustomerId AS PeerId, p2.Name AS P2Name)
) AS results${geo !== 'global' ? `\nJOIN Inventory i ON results.P2ProductId = i.ProductId\nJOIN Stores s ON i.StoreId = s.StoreId` : ''}
${geo !== 'global' ? `WHERE s.PlacementKey = '${geo}'` : ''}
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

      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4 pr-40">Peer Recommendations via Graph</h1>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-google-blue animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-6 flex flex-col">

          <div className="space-y-3 mb-6">
            {recommendations.length === 0 ? (
              <p className="text-sm text-google-gray-800">No peer recommendations found.</p>
            ) : (
              recommendations.map((rec, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-center p-4 bg-google-gray-50 hover:bg-google-blue/5 cursor-pointer rounded-lg transition-colors border border-google-gray-100 hover:border-google-blue/30"
                  onClick={() => handleRecClick(rec)}
                >
                  <span className="font-semibold text-google-gray-900 text-lg">{rec.p_Name}</span>
                  <span className="text-xs text-google-blue bg-blue-100 uppercase tracking-widest font-bold px-3 py-1 rounded-full shadow-sm">
                    {rec.PeerPurchaseCount} peer overlaps
                  </span>
                </div>
              ))
            )}
          </div>
          {recommendations.length > 0 && (
              <div className="text-sm text-google-gray-500 mt-auto text-center italic bg-google-gray-50 p-2 rounded-lg border border-google-gray-200">
                  Select a product above to inspect the causal graph!
              </div>
          )}
        </div>
      )}

      {/* Graph Modal Overlay */}
      {selectedGraph && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 p-4 sm:p-8 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-h-[90vh] max-w-5xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
                
                {/* Dynamically Generated Analysis */}
                <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex gap-3 text-sm text-google-gray-800">
                  <Share2 className="w-6 h-6 text-google-blue shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-google-blue mb-1 uppercase tracking-wider text-xs">Path Analysis Result</h4>
                    <p className="leading-relaxed text-google-gray-800">{selectedGraph.analysisText}</p>
                  </div>
                </div>

                <div className="flex-1 relative bg-white">
                    <div className="absolute top-4 left-4 z-10 text-xs font-mono text-google-gray-600 bg-white/90 px-3 py-2 rounded-lg shadow-sm border border-google-gray-100">
                        <span>🟡 You | 🔵 Product | ⚪ Peer | 🟢 Recommended</span>
                    </div>
                    <div className="w-full h-[55vh] overflow-hidden">
                        {/* @ts-ignore */}
                        {selectedGraph.data.nodes.length > 0 && (
                        <ForceGraph2D
                            ref={graphRef}
                            width={window.innerWidth * 0.8}
                            height={window.innerHeight * 0.55}
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
                                if (node.group === 'You') fillColor = '#F9AB00';
                                else if (node.group === 'Product') fillColor = '#4285F4';
                                else if (node.group === 'Peer') fillColor = '#9AA0A6';
                                else if (node.group === 'Recommended Product') fillColor = '#34A853';

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
              <h2 className="font-bold text-lg text-white">About Collaborative Match via Graph</h2>
              <button onClick={() => setShowAbout(false)} className="text-white/80 hover:text-white rounded-full hover:bg-white/10 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-google-gray-600 text-sm leading-relaxed bg-white">
              <p className="font-bold text-google-gray-900 text-base">Spanner Property Graph capability (GQL).</p>
              <p>
                Using Collaborative filtering patterns via graph: traversing 4-hop path correlations securely inside Spanner without leaving the operational database.
              </p>
              <div className="bg-google-gray-50 p-4 rounded-lg border border-google-gray-200 mt-2">
                <p className="font-bold text-google-gray-900 mb-1">What is a &quot;Peer Overlap&quot;?</p>
                <p>
                  The peer overlap number represents the count of unique customers (your &quot;peers&quot;) who purchased at least one of the exact same products as you, and then also went on to purchase the recommended product. A higher overlap number indicates a stronger, more confident recommendation driven by similar user behavior!
                </p>
                <p className="font-bold text-google-gray-900 mt-4 mb-1">Geo-Partitioning (Recommendations)</p>
                <p>
                  When a specific region is selected, the Graph query dynamically <code>JOIN</code>s the Graph's recommended product output against the relational <strong>Inventory</strong> and <strong>Stores</strong> tables, pushing a <code>PlacementKey</code> filter. This guarantees that Spanner only returns peer recommendations for products actively available in your local region!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
