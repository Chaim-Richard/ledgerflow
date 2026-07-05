import React, { useState } from 'react';
import { CreditCard, Banknote, ShoppingBag, Search, Plus, Minus, Trash2, Maximize, User, Tag, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function PosTerminal() {
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const products: any[] = [];

  const categories = ['All', 'Beverages', 'Equipment', 'Accessories', 'Pantry'];
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredProducts = products.filter(p => 
    (activeCategory === 'All' || p.category === activeCategory) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.priceCents * item.qty), 0);
  const tax = Math.round(subtotal * 0.08); // 8% tax
  const total = subtotal + tax;

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA] overflow-hidden">
      <div className="px-6 py-4 bg-[#0A0A0A] text-white flex justify-between items-center z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">POS Terminal</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Register #04 • Cashier: JD</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-sm font-bold hover:bg-white/20 transition-colors">
            <User className="w-4 h-4" /> Add Customer
          </button>
          <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product Grid */}
        <div className="flex-1 flex flex-col bg-[#FAFAFA] overflow-hidden">
          <div className="p-6 border-b border-[#E5E5E5] bg-white">
            <div className="relative mb-6">
              <Search className="w-5 h-5 text-[#A3A3A3] absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search products, scan barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-14 pl-12 pr-6 bg-[#FAFAFA] border border-[#E5E5E5] rounded-2xl text-lg focus:outline-none focus:border-[#0A0A0A] font-medium"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                    activeCategory === cat ? "bg-[#0A0A0A] text-white" : "bg-white border border-[#E5E5E5] text-[#525252] hover:bg-[#FAFAFA]"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <div 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white border border-[#E5E5E5] rounded-2xl p-4 cursor-pointer hover:border-[#0A0A0A] hover:shadow-md transition-all active:scale-95 flex flex-col h-40"
                >
                  <div className="flex justify-between items-start mb-auto">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-[#FAFAFA] border border-[#E5E5E5] rounded text-[#525252]">
                      {product.category}
                    </span>
                    <span className="text-xs font-mono text-[#A3A3A3]">{product.stock} in stock</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0A0A0A] leading-tight mb-2 line-clamp-2">{product.name}</h3>
                    <div className="font-mono font-bold text-lg text-emerald-600">${(product.priceCents / 100).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Cart & Checkout */}
        <div className="w-[420px] bg-white border-l border-[#E5E5E5] flex flex-col shadow-xl z-20">
          <div className="p-6 border-b border-[#E5E5E5] bg-[#FAFAFA]">
            <h2 className="text-lg font-bold text-[#0A0A0A]">Current Order</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#A3A3A3] space-y-4">
                <ShoppingBag className="w-16 h-16 opacity-20" />
                <p className="font-bold text-sm uppercase tracking-widest">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="p-4 bg-white border border-[#E5E5E5] rounded-xl flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-[#0A0A0A] truncate pr-4">{item.name}</h4>
                      <div className="font-mono text-sm text-[#525252] mt-1">${(item.priceCents / 100).toFixed(2)} / ea</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg overflow-hidden">
                        <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-[#E5E5E5] text-[#525252]">
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="w-8 h-8 flex items-center justify-center font-bold text-sm bg-white border-x border-[#E5E5E5]">
                          {item.qty}
                        </div>
                        <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-[#E5E5E5] text-[#525252]">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="w-16 text-right font-mono font-bold text-[#0A0A0A]">
                        ${((item.priceCents * item.qty) / 100).toFixed(2)}
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-[#FAFAFA] border-t border-[#E5E5E5] space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#525252]">
                <span>Subtotal</span>
                <span className="font-mono">${(subtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#525252]">
                <span>Tax (8%)</span>
                <span className="font-mono">${(tax / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#525252]">
                <span>Discount</span>
                <span className="font-mono text-emerald-600">-$0.00</span>
              </div>
            </div>
            
            <div className="pt-4 border-t border-[#E5E5E5] flex justify-between items-end">
              <span className="text-sm font-bold text-[#0A0A0A] uppercase tracking-wider">Total</span>
              <span className="text-4xl font-bold font-mono text-[#0A0A0A]">${(total / 100).toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button 
                disabled={cart.length === 0}
                className="h-14 bg-white border-2 border-[#E5E5E5] rounded-xl flex items-center justify-center gap-2 font-bold text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors disabled:opacity-50"
              >
                <Banknote className="w-5 h-5" /> Cash
              </button>
              <button 
                disabled={cart.length === 0}
                className="h-14 bg-[#0A0A0A] rounded-xl flex items-center justify-center gap-2 font-bold text-white hover:bg-[#1A1A1A] transition-colors shadow-lg disabled:opacity-50"
              >
                <CreditCard className="w-5 h-5" /> Card
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
