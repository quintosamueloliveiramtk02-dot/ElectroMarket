import React from 'react';
import { Product } from '../types';
import { Battery, MapPin, Sparkles } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  key?: string | number;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  // Safe default formatting for Brazilian Real Currency
  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      console.log(`[ProductCard] Click sem callback customizado. Emitindo evento '/ads/${product.id}'`);
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('navigate_ad_details', { detail: { id: product.id } });
        window.dispatchEvent(event);
      }
    }
  };

  return (
    <div
      id={`product-card-${product.id}`}
      onClick={handleClick}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm group hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col h-full transform hover:-translate-y-1"
    >
      {/* Image Aspect ratio container with cover and badge */}
      <div className="relative aspect-square overflow-hidden bg-slate-50 border-b border-slate-100 flex items-center justify-center">
        <img
          src={product.images && product.images[0] ? product.images[0] : 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80'}
          alt={product.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
        />
        
        {/* Battery Health badge */}
        {product.batteryHealth && (
          <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
            <span>{product.batteryHealth}%</span>
          </div>
        )}

        {/* Brand Pill badge tag */}
        <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-md text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 uppercase">
          {product.brand}
        </span>

        {/* Featured Special badge */}
        {product.isFeatured && (
          <span className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-md text-white text-[10px] uppercase font-extrabold px-2 py-0.5 rounded tracking-wide shadow-md flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>Destaque</span>
          </span>
        )}
      </div>

      {/* Info and content panel */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate" title={product.title}>
            {product.title}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[3rem]">
            {product.description || 'Nenhuma descrição detalhada disponível.'}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-[#004ac6]">
              {formatPrice(product.price)}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400 font-medium">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate max-w-[120px]">{product.location}</span>
            </div>
            <span>{product.storage || '128GB'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
