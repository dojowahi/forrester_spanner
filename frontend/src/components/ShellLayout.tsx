import { useState } from 'react';
import { Store, ShieldAlert, ThumbsUp, TrendingUp, Database, Activity } from 'lucide-react';
import SearchView from '../views/SearchView';
import FraudView from '../views/FraudView';
import RecsView from '../views/RecsView';
import GeoView from '../views/GeoView';
import CartView from '../views/CartView';
import DbDataView from '../views/DbDataView';

type TabId = 'storefront' | 'risk' | 'growth' | 'db' | 'supply' | 'recs';

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
  const [activeTab, setActiveTab] = useState<TabId>('storefront');

  const renderContent = () => {
    switch(activeTab) {
      case 'storefront': return <SearchView />;
      case 'risk': return <FraudView />;
      case 'recs': return <RecsView />;
      case 'db': return <DbDataView />;
      case 'supply': return <CartView />;
      case 'growth': return <GeoView />;
    }
  };

  return (
    <div className="min-h-screen bg-google-gray-50 flex flex-col lg:flex-row antialiased">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-r border-google-gray-200 p-4 flex flex-col gap-6 shrink-0">
        <div className="flex items-center gap-3 px-2">
          {/* Logo icon approximation */}
          <div className="w-8 h-8 rounded-full bg-google-blue flex items-center justify-center text-white font-bold text-lg">
            G
          </div>
          <span className="font-semibold text-google-blue tracking-tight text-lg">Super <span className="text-google-red">Spanner</span></span>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1 mt-4">
          <NavItem label="Storefront (CX)" icon={<Store className="w-4 h-4" />} active={activeTab === 'storefront'} onClick={() => setActiveTab('storefront')} />
          <NavItem label="Checkout simulator" icon={<Activity className="w-4 h-4" />} active={activeTab === 'supply'} onClick={() => setActiveTab('supply')} />
          <NavItem label="Fraud Rings" icon={<ShieldAlert className="w-4 h-4" />} active={activeTab === 'risk'} onClick={() => setActiveTab('risk')} />
          <NavItem label="Peer Recs" icon={<ThumbsUp className="w-4 h-4" />} active={activeTab === 'recs'} onClick={() => setActiveTab('recs')} />
          <NavItem label="Geospatial" icon={<TrendingUp className="w-4 h-4" />} active={activeTab === 'growth'} onClick={() => setActiveTab('growth')} />

          <div className="my-2 border-t border-google-gray-100"></div>

          <NavItem label="DB Data" icon={<Database className="w-4 h-4" />} active={activeTab === 'db'} onClick={() => setActiveTab('db')} />
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-google-gray-200 px-6 py-4 flex items-center">
          <h1 className="text-lg font-bold text-google-blue">Retail Control Tower Dashboard</h1>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
