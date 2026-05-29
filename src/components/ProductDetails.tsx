import React, { useState } from "react";
import { Product } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, MapPin, Cpu, Battery, ShieldCheck, HardDrive, Tag, Calendar, ChevronLeft } from "lucide-react";

interface ProductDetailsProps {
  product: Product;
  onNegotiate: () => void;
  onBack?: () => void;
}

export default function ProductDetails({ product, onNegotiate, onBack }: ProductDetailsProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Fallback check if images array is empty
  const images = product.images && product.images.length > 0
    ? product.images
    : ["https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=800"];

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(product.price);

  const formattedDate = new Date(product.createdAt).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full max-w-7xl mx-auto px-4 py-8"
      id="product-details-container"
    >
      {onBack && (
        <button
          onClick={onBack}
          className="group mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          id="btn-back-to-products"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Voltar para anúncios
        </button>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12" id="product-details-grid">
        
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-7 flex flex-col gap-4" id="gallery-column">
          {/* Main Image Stage */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-50 border border-slate-100 shadow-sm" id="main-image-stage">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImageIndex}
                src={images[activeImageIndex]}
                alt={product.title}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain p-4"
              />
            </AnimatePresence>
            
            {product.isFeatured && (
              <span className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white tracking-wide shadow-sm">
                <Tag className="h-3.5 w-3.5" />
                Destaque
              </span>
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200" id="thumbnail-strip">
              {images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImageIndex(index)}
                  className={`relative aspect-square w-20 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg bg-slate-50 border transition-all duration-200 ${
                    activeImageIndex === index
                      ? "border-blue-600 ring-2 ring-blue-600/10"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  aria-label={`Visualizar imagem ${index + 1}`}
                >
                  <img
                    src={img}
                    alt={`${product.title} - miniatura ${index + 1}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover p-1"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Key Details & Specs */}
        <div className="lg:col-span-5 flex flex-col justify-between" id="details-column">
          <div className="space-y-6">
            {/* Header Metadata */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase">
                  {product.brand}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {product.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formattedDate}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight" id="product-title-detail">
                {product.title}
              </h1>
            </div>

            {/* Premium Price Highlight */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-5" id="price-section">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                Preço sugerido
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-extrabold text-slate-900" id="product-price-detail">
                  {formattedPrice}
                </span>
              </div>
            </div>

            {/* Specifications Cards Grid */}
            <div className="space-y-3" id="specifications-badges">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                Especificações Técnicas
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Brand / Model */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Cpu className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Modelo</p>
                    <p className="truncate text-xs font-semibold text-slate-700">{product.model}</p>
                  </div>
                </div>

                {/* Storage */}
                {product.storage && (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200 transition-colors">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <HardDrive className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Armazenamento</p>
                      <p className="truncate text-xs font-semibold text-slate-700">{product.storage}</p>
                    </div>
                  </div>
                )}

                {/* Battery Health */}
                {typeof product.batteryHealth !== 'undefined' && (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200 transition-colors">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Battery className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Saúde da Bateria</p>
                      <p className="truncate text-xs font-semibold text-slate-700">{product.batteryHealth}%</p>
                    </div>
                  </div>
                )}

                {/* Warranty */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Garantia</p>
                    <p className="truncate text-xs font-semibold text-slate-700">
                      {product.hasWarranty ? "Ativa" : "Não informada"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description Block */}
            <div className="space-y-2 border-t border-slate-100 pt-6" id="description-section">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Descrição do anúncio
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                {product.description || "Nenhuma descrição fornecida pelo anunciante."}
              </p>
            </div>
          </div>

          {/* Negotiate Action Button */}
          <div className="mt-8 border-t border-slate-100 pt-6" id="negotiate-action-section">
            <button
              onClick={onNegotiate}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              id="btn-negotiate-chat"
            >
              <MessageSquare className="h-5 w-5 fill-current" />
              Negociar no Chat
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-3">
              Ao clicar, você será redirecionado para um chat seguro com o vendedor do item.
            </p>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
