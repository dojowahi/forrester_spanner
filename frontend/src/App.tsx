import ShellLayout from './components/ShellLayout';
import { CartProvider } from './context/CartContext';
import { GeoProvider } from './context/GeoContext';

function App() {
  return (
    <GeoProvider>
      <CartProvider>
        <ShellLayout />
      </CartProvider>
    </GeoProvider>
  );
}

export default App;
