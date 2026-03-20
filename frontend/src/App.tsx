import ShellLayout from './components/ShellLayout';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <CartProvider>
      <ShellLayout />
    </CartProvider>
  );
}

export default App;
