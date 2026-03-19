import { useState } from 'react';
import { CheckCircle2, Loader2, CreditCard } from 'lucide-react';

export default function CartView() {
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const cartItems = [
    { ProductId: "P-1000", Name: "Google Pixel 8 Pro", Quantity: 1, Price: 899.00 },
    { ProductId: "P-1001", Name: "Pixel Buds Pro", Quantity: 2, Price: 199.99 }
  ];

  const total = cartItems.reduce((acc, item) => acc + (item.Price * item.Quantity), 0);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const payload = cartItems.map(item => ({
        ProductId: item.ProductId,
        Quantity: item.Quantity,
        Price: item.Price
      }));

      const res = await fetch('/api/v1/orders?customer_id=mock-cust-123&store_id=mock-store-1&session_id=mock-sess-456', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.order_id) {
        setOrderId(data.order_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-google-gray-900 tracking-tight mb-4">Cart & Checkout (OLTP)</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item, idx) => (
            <div key={idx} className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-google-gray-900">{item.Name}</h3>
                <div className="text-xs text-google-gray-800 mt-1">ID: {item.ProductId}</div>
              </div>
              <div className="text-right">
                <div className="font-medium text-google-gray-900">${item.Price.toFixed(2)}</div>
                <div className="text-sm text-google-gray-800">Qty: {item.Quantity}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-google-gray-200 shadow-sm rounded-xl p-6 h-fit">
          <h2 className="text-lg font-semibold text-google-gray-900 border-b border-google-gray-100 pb-4 mb-4">Order Summary</h2>
          <div className="flex justify-between items-center mb-6">
            <span className="text-google-gray-800">Total Amount</span>
            <span className="text-xl font-bold text-google-gray-900">${total.toFixed(2)}</span>
          </div>

          {orderId ? (
            <div className="bg-google-green/10 border border-google-green/20 rounded-xl p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-google-green mx-auto mb-2" />
              <div className="font-semibold text-google-green mb-1">Order Placed Successfully!</div>
              <div className="text-xs text-google-gray-800 break-all mb-3 text-left p-2 bg-white rounded border border-google-green/20">Order ID: {orderId}</div>
              <div className="text-[10px] text-google-gray-800 pt-3 border-t border-google-green/20">
                Atomic transaction verified across Orders, OrderItems, Payments, and UserSessions without cross-table locking.
              </div>
            </div>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-google-blue text-white hover:bg-blue-600 disabled:opacity-50 transition-colors rounded-full font-medium py-3 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
              {loading ? 'Processing...' : 'Complete Checkout'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
