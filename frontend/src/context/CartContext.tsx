import { createContext, useContext, useState, type ReactNode } from 'react';

export interface CartItem {
  ProductId: string;
  Name: string;
  Quantity: number;
  Price: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (newItem: CartItem) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.ProductId === newItem.ProductId);
      if (existing) {
        return prev.map(i =>
          i.ProductId === newItem.ProductId ? { ...i, Quantity: i.Quantity + 1 } : i
        );
      }
      return [...prev, newItem];
    });
  };

  const clearCart = () => setCartItems([]);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
