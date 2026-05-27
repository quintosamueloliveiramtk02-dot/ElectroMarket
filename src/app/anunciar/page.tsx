'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';
import { 
  Plus, 
  Smartphone, 
  Battery, 
  MapPin, 
  DollarSign, 
  Tag, 
  Layers, 
  Image as ImageIcon, 
  Trash2, 
  ArrowLeft, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Outros'];
const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB+'];

// Algumas imagens de smartphone premium recomendadas para facilitar se o usuário não tiver uma url
const DEFAULT_PRESET_IMAGES = [
  { name: 'iPhone Titanium', url: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80' },
  { name: 'Samsung Galaxy Ultra', url: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80' },
  { name: 'Xiaomi Pro Midnight', url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80' },
  { name: 'Motorola Razr Foldable', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80' },
];

export default function AnunciarPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Estados dos Campos
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [brand, setBrand] = useState('Apple');
  const [model, setModel] = useState('');
  const [storage, setStorage] = useState('128GB');
  const [batteryHealth, setBatteryHealth] = useState('85');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  
  // Imagens
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  
  // Estados de Controle / UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redireciona se não estiver logado
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Anunciante precisa fazer login.');
    }
  }, [user, authLoading]);

  // Função para adicionar imagem à lista
  const handleAddImageUrl = (url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    if (images.length >= 4) {
      setErrorMessage('Você pode adicionar no máximo 4 imagens por anúncio.');
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMessage('Por favor, informe uma URL de imagem válida (começando com http:// ou https://).');
      return;
    }

    setImages(prev => [...prev, cleanUrl]);
    setImageUrlInput('');
    setErrorMessage(null);
  };

  // Remover imagem da lista
  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submeter formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validações básicas obrigatórias do backend
    if (!title.trim()) return setErrorMessage('O título do anúncio é obrigatório.');
    if (!price.trim()) return setErrorMessage('O preço do celular é obrigatório.');
    if (!brand.trim()) return setErrorMessage('A marca é obrigatória.');
    if (!model.trim()) return setErrorMessage('O modelo específico é obrigatório.');
    if (!location.trim()) return setErrorMessage('A cidade e estado são obrigatórios.');

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return setErrorMessage('O preço informado deve ser um número maior que zero.');
    }

    const batteryNum = parseInt(batteryHealth, 10);
    if (batteryHealth && (isNaN(batteryNum) || batteryNum < 50 || batteryNum > 100)) {
      return setErrorMessage('A saúde da bateria deve ser um número de 50 a 100%.');
    }

    // Se não informou nenhuma imagem do smartphone, adicionamos um preset básico da marca
    let finalImages = [...images];
    if (finalImages.length === 0) {
      const matchedPreset = DEFAULT_PRESET_IMAGES.find(p => p.name.toLowerCase().includes(brand.toLowerCase())) || DEFAULT_PRESET_IMAGES[0];
      finalImages = [matchedPreset.url];
    }

    try {
      setIsSubmitting(true);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        brand,
        model: model.trim(),
        batteryHealth: batteryHealth ? batteryNum : null,
        storage,
        images: finalImages,
        location: location.trim(),
        isFeatured: false
      };

      const result = await api.post<{ ad: { id: string } }>('/ads', payload);
      
      setSuccessMessage('Parabéns! Anúncio publicado com extremo sucesso.');
      
      // Delay curto para o usuário ler o sucesso e redireciona
      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (err: any) {
      console.error('Erro ao anunciar o smartphone:', err);
      setErrorMessage(err.message || 'Erro ao publicar seu iPhone. Revise suas informações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-semibold text-slate-500">Garantindo nível de segurança do usuário...</p>
        </div>
      </div>
    );
  }

  // Visual se o usuário não estiver autenticado
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 max-w-md mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="bg-blue-50 p-4 rounded-full border border-blue-100 text-blue-600 mb-4 shadow-sm">
            <Smartphone className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Crie seu Anúncio</h2>
          <p className="text-slate-550 text-xs sm:text-sm mt-2 mb-6 leading-relaxed">
            Você precisa estar logado na sua conta ElectroMarket para divulgar celulares seminovos e negociar com compradores de todo o país.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => router.push('/login')}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition duration-150 active:scale-95 shadow-md hover:shadow-lg cursor-pointer"
            >
              Fazer Login agora
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {/* Botão de regressão */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-blue-600 mb-6 transition select-none group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Voltar para a Vitrine</span>
        </button>

        {/* Header Informativo */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <Plus className="w-6 h-6 text-blue-600" />
            Vender iPhone ou Smartphone
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed font-medium">
            Preencha a ficha técnica do seu telefone, diga as condições de hardware e saúde da bateria. Seu anúncio ficará disponível na vitrine em tempo real para milhares de compradores!
          </p>
        </div>

        {/* FEEDBACK STATUS */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-start gap-2.5 shadow-sm text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block">Erro ao Criar Anúncio</span>
              <span className="font-medium text-red-600">{errorMessage}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl mb-6 flex items-start gap-2.5 shadow-sm text-xs sm:text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-505 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block">Cadastro Efetuado!</span>
              <span className="font-medium text-emerald-700">{successMessage}</span>
            </div>
          </div>
        )}

        {/* FORMULÁRIO DO ANÚNCIO */}
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          
          {/* Seção 1: Dados Principais */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-blue-600 tracking-widest border-b border-slate-100 pb-2">
              1. Identidade do Anúncio
            </h3>

            {/* Título do Anúncio */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Título do Anúncio *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="EX: iPhone 14 Pro Max 256GB - Excelente estado"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                  className="w-full bg-slate-55 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  required
                />
              </div>
            </div>

            {/* Preço e Localização */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Preço do anúncio */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                  Preço do Smartphone (R$) *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-xs font-extrabold text-slate-400">R$</span>
                  <input
                    type="number"
                    placeholder="3450"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="1"
                    step="0.01"
                    className="w-full bg-slate-55 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

              {/* Localização */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                  Cidade e Estado *
                </label>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-4 w-4 h-4 text-slate-450" />
                  <input
                    type="text"
                    placeholder="EX: São Paulo - SP"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-55 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Seção 2: Hardware e Especificações */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase text-blue-600 tracking-widest border-b border-slate-100 pb-2">
              2. Ficha Técnica e Estado
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Marca */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                  Marca *
                </label>
                <div className="relative">
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-slate-55 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition appearance-none font-sans"
                  >
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modelo */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                  Modelo do Aparelho *
                </label>
                <input
                  type="text"
                  placeholder="EX: iPhone 13 Pro ou Galaxy S22 Ultra"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-55 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  required
                />
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Armazenamento */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                  Capacidade de Memória *
                </label>
                <select
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full bg-slate-55 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition appearance-none font-sans"
                >
                  {STORAGE_OPTIONS.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Saúde da Bateria */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                  Saúde Máxima da Bateria (%)
                </label>
                <div className="relative flex items-center">
                  <Battery className="absolute left-4 w-4 h-4 text-slate-450" />
                  <input
                    type="number"
                    placeholder="EX: 87"
                    value={batteryHealth}
                    onChange={(e) => setBatteryHealth(e.target.value)}
                    min="50"
                    max="100"
                    className="w-full bg-slate-55 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                  Número de 50 a 100%. Deixe vazio se não souber.
                </span>
              </div>

            </div>
          </div>

          {/* Seção 3: Galeria de Fotos */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase text-blue-600 tracking-widest">
                3. Fotos do Smartphone (Máximo 4)
              </h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {images.length}/4 inseridas
              </span>
            </div>

            {/* Input URL da Imagem */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Inserir Link de Imagem
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Cole aqui o link direto da imagem (URL terminando em .jpg, .png...)"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="flex-1 bg-slate-55 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => handleAddImageUrl(imageUrlInput)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 rounded-xl transition cursor-pointer select-none active:scale-95 shrink-0 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* Presets Rápidos de Fotos */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Links Rápidos de Modelos Ilustrativos:</span>
              <div className="flex flex-wrap gap-2.5">
                {DEFAULT_PRESET_IMAGES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleAddImageUrl(preset.url)}
                    className="bg-slate-50 hover:bg-slate-100 hover:text-blue-600 border border-slate-200 rounded-lg text-[10px] font-bold px-3 py-1.5 text-slate-600 transition cursor-pointer"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Listagem de Previews de Imagens */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
                    <img
                      src={img}
                      alt={`Minhas fotos ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {/* Botão de Excluir individual */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-90 transition cursor-pointer shadow-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] font-semibold px-2 py-0.5 rounded backdrop-blur">
                      Foto {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção 4: Descrição */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase text-blue-600 tracking-widest border-b border-slate-100 pb-2">
              4. Descrição do Celular
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wider">
                Detalhes de Conservação
              </label>
              <textarea
                placeholder="EX: Aparelho impecável com 1 ano de uso, acompanha caixa e carregador original. Saúde de bateria em 87%, sem nenhum arranhão na carcaça ou visor. Sempre utilizado com capa protetora."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full bg-slate-55 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition resize-none font-sans"
              />
            </div>
          </div>

          {/* Botão de Submissão final do Formulário */}
          <div className="pt-4 border-t border-slate-105 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-sm py-4 px-8 rounded-xl shadow-lg shadow-blue-500/10 transition cursor-pointer select-none active:scale-[0.98]"
            >
              {isSubmitting ? 'Publicando Anúncio...' : 'Confirmar e Publicar Anúncio'}
            </button>
          </div>

        </form>

      </main>
    </div>
  );
}
