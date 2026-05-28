import React from 'react';

export default function ProductSkeletonGrid() {
  return (
    <div id="product-skeleton-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <div key={n} id={`skeleton-card-${n}`} className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden p-4 space-y-4 animate-pulse shadow-sm">
          <div className="aspect-square bg-slate-200 rounded-xl w-full"></div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            <div className="h-3 bg-slate-200 rounded w-5/6"></div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-3 bg-slate-200 rounded w-1/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
