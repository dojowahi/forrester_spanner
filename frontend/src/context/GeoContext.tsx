import { createContext, useContext, useState, type ReactNode } from 'react';

export type PlacementGroup = 'global' | 'americas' | 'europe' | 'asia';

interface GeoContextType {
  geo: PlacementGroup;
  setGeo: (geo: PlacementGroup) => void;
}

const GeoContext = createContext<GeoContextType | undefined>(undefined);

export function GeoProvider({ children }: { children: ReactNode }) {
  const [geo, setGeo] = useState<PlacementGroup>('global');
  
  return (
    <GeoContext.Provider value={{ geo, setGeo }}>
      {children}
    </GeoContext.Provider>
  );
}

export function useGeo() {
  const context = useContext(GeoContext);
  if (context === undefined) {
    throw new Error('useGeo must be used within a GeoProvider');
  }
  return context;
}
