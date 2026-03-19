import { useState } from 'react';
import { Search, BarChart2, Map, ShoppingCart, Globe } from 'lucide-react';
import SearchView from '../views/SearchView';
import GraphView from '../views/GraphView';
import GeoView from '../views/GeoView';
import CartView from '../views/CartView';

type TabId = 'search' | 'graph' | 'geo' | 'cart';

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

const NavItem = ({ label, icon, active, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors w-full cursor-pointer ${
      active 
        ? 'bg-google-blue/10 text-google-blue border border-google-blue/30' 
        : 'text-google-gray-800 hover:bg-google-gray-100'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default function ShellLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('search');

  const renderContent = () => {
    switch(activeTab) {
      case 'search': return <SearchView />;
      case 'graph': return <GraphView />;
      case 'geo': return <GeoView />;
      case 'cart': return <CartView />;
    }
  };

  return (
    <div className="min-h-screen bg-google-gray-50 flex flex-col lg:flex-row antialiased">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-r border-google-gray-200 p-4 flex flex-col gap-6">
        <div className="flex items-center gap-2 px-2">
          <Globe className="w-6 h-6 text-google-blue" />
          <span className="font-semibold text-google-gray-900 tracking-tight">Retail Nexus</span>
        </div>
        
        <nav className="flex flex-col gap-1 flex-1">
          <NavItem label="Hybrid Search" icon={<Search className="w-4 h-4" />} active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
          <NavItem label="Graph Insights" icon={<BarChart2 className="w-4 h-4" />} active={activeTab === 'graph'} onClick={() => setActiveTab('graph')} />
          <NavItem label="Geospatial Map" icon={<Map className="w-4 h-4" />} active={activeTab === 'geo'} onClick={() => setActiveTab('geo')} />
          <NavItem label="OLTP Checkout" icon={<ShoppingCart className="w-4 h-4" />} active={activeTab === 'cart'} onClick={() => setActiveTab('cart')} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}
