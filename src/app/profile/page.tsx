import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Product, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Battery, 
  Trash2, 
  Pencil, 
  ArrowLeft, 
  AlertCircle, 
  Loader2, 
  Package, 
  X, 
  Check, 
  Sparkles,
  Smartphone
} from 'lucide-react';

interface ProfilePageProps {
  onBack?: () => void;
  onNavigate?: (path: string) => void;
}

export default function ProfilePage({ onBack, onNavigate }: ProfilePageProps) {
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal States
  const [editingAd, setEditingAd] = useState<Product | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editStorage, setEditStorage] = useState('');
  const [editBatteryHealth, setEditBatteryHealth] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const fetchMyProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Product[]>('/users/me/products');
      setProducts(data);
    } catch (err: any) {
      console.error('Erro ao buscar anúncios próprios:', err);
      setError(err?.message || 'Falha ao carregar seus anúncios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyProducts();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleEditClick = (ad: Product) => {
    setEditingAd(ad);
    setEditTitle(ad.title);
    setEditPrice(ad.price.toString());
    setEditBrand(ad.brand);
    setEditModel(ad.model);
    setEditStorage(ad.storage || '');
    setEditBatteryHealth(ad.batteryHealth ? ad.batteryHealth.toString() : '');
    setEditLocation(ad.location);
    setEditDescription(ad.description || '');
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const parsedPrice = parseFloat(editPrice);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        throw new Error('Insira um preço válido maior do que zero.');
      }

      const batteryNum = editBatteryHealth ? parseInt(editBatteryHealth, 10) : null;
      if (batteryNum !== null && (isNaN(batteryNum) || batteryNum < 0 || batteryNum > 100)) {
        throw new Error('A saúde da bateria deve ser um número entre 0% e 100%.');
      }

      const updatedAdResponse = await api.put<any>(`/ads/${editingAd.id}`, {
        title: editTitle,
        price: parsedPrice,
        brand: editBrand,
        model: editModel,
        storage: editStorage || null,
        batteryHealth: batteryNum,
        location: editLocation,
        description: editDescription
      });

      setSubmitSuccess('Anúncio atualizado com sucesso!');
      
      // Update local state list
      setProducts(prev => prev.map(p => p.id === editingAd.id ? { 
        ...p, 
        title: editTitle,
        price: parsedPrice,
        brand: editBrand,
        model: editModel,
        storage: editStorage || undefined,
        batteryHealth: batteryNum || undefined,
        location: editLocation,
        description: editDescription
      } : p));

      // Close modal after delay
      setTimeout(() => {
        setEditingAd(null);
      }, 1500);

    } catch (err: any) {
      console.error('Erro ao atualizar anúncio:', err);
      setSubmitError(err?.message || 'Erro inesperado ao salvar alterações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Tem certeza absoluta que deseja excluir este anúncio? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await api.delete(`/ads/${productId}`);
      setProducts(prev => prev.filter(p => p.id !== productId));
      alert('Anúncio excluído com sucesso!');
    } catch (err: any) {
      console.error('Erro ao excluir anúncio:', err);
      alert(err?.message || 'Não foi possível excluir o anúncio.');
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-600 font-medium">Verificando sua sessão...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-md">
        <UserIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Painel do Usuário</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          Você precisa estar logado para visualizar e gerenciar seus anúncios particulares cadastrados.
        </p>
        <button
          onClick={() => {
            if (onNavigate) {
              onNavigate('/');
            } else {
              handleBack();
            }
          }}
          className="mt-6 bg-[#2563eb] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition cursor-pointer"
        >
          Ir para a Vitrine
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-250">
      
      {/* Voltar link e Título */}
      <div className="flex items-center gap-2">
        <button 
          onClick={handleBack}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition flex items-center justify-center cursor-pointer"
          title="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="border-l border-slate-200 pl-3">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">Gerenciar Conta</h1>
          <p className="text-xs text-slate-500 font-medium">Controle total de seus dados e anúncios ativos</p>
        </div>
      </div>

      {/* User Card Information Header (Painel de Controle) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start md:justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <img
            src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120px&h=120px&q=80'}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-white shadow-md object-cover ring-4 ring-slate-100"
          />
          <div className="text-center sm:text-left space-y-1 mt-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{user.name}</h2>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-x-4 sm:gap-y-1 text-xs text-slate-500 pt-1 font-medium">
              <span className="flex items-center justify-center sm:justify-start gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{user.email}</span>
              </span>
              {user.phone && (
                <span className="flex items-center justify-center sm:justify-start gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{user.phone}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-center min-w-[140px] shrink-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Seus Anúncios</span>
          <span className="text-3xl font-extrabold text-blue-600 block mt-1">
            {loading ? '-' : products.length}
          </span>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">cadastrados</span>
        </div>
      </div>

      {/* Meus Anúncios Vitrine Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-800">Seus Smartphones Cadastrados</h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center shadow-xs">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">Falha ao conectar ao banco</p>
            <p className="text-xs text-red-650 mt-1">{error}</p>
          </div>
        )}

        {!error && (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-4 animate-pulse">
                  <div className="aspect-square bg-slate-200 rounded-xl"></div>
                  <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-12 px-6 text-center shadow-xs">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-850">Você ainda não anunciou</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1 leading-relaxed">
                Comece a faturar agora mesmo! Coloque seu smartphone seminovo à venda para milhares de compradores na plataforma.
              </p>
              <button
                onClick={() => {
                  const event = new CustomEvent('trigger_announce_modal');
                  window.dispatchEvent(event);
                }}
                className="mt-5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-sm"
              >
                Criar Primeiro Anúncio
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(ad => (
                <div 
                  key={ad.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition duration-200 flex flex-col h-full relative group"
                >
                  <div className="relative aspect-square bg-slate-50 overflow-hidden flex items-center justify-center">
                    <img 
                      src={ad.images && ad.images[0] ? ad.images[0] : 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80'} 
                      alt={ad.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />

                    {ad.batteryHealth && (
                      <span className="absolute bottom-2.5 left-2.5 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                        <Battery className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Saúde: {ad.batteryHealth}%</span>
                      </span>
                    )}

                    <span className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-xs text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider">
                      {ad.brand}
                    </span>

                    {ad.isFeatured && (
                      <span className="absolute top-2.5 left-2.5 bg-slate-900/90 text-white text-[10px] uppercase font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Destaque</span>
                      </span>
                    )}
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition truncate" title={ad.title}>
                        {ad.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                        {ad.description || 'Sem descrição cadastrada.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-extrabold text-[#004ac6]">
                          R$ {ad.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          <span>{ad.location}</span>
                        </div>
                      </div>

                      {/* Control Panel Buttons (Editar e Excluir) */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          id={`profile-btn-edit-${ad.id}`}
                          onClick={() => handleEditClick(ad)}
                          className="bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-slate-700 hover:text-blue-600 border border-slate-200 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 duration-100 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          id={`profile-btn-delete-${ad.id}`}
                          onClick={() => handleDelete(ad.id)}
                          className="bg-slate-50 hover:bg-red-50 hover:border-red-200 text-slate-700 hover:text-red-600 border border-slate-200 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 duration-100 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Edit Announcement Modal Form Panel */}
      {editingAd && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 transform animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Editar Smartphone</h3>
              </div>
              <button 
                onClick={() => setEditingAd(null)}
                className="p-1 px-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition duration-150 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto max-h-[75vh] space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-pulse">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest leading-none">Título do Anúncio</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: iPhone 14 Pro Max 256GB Grafite"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 focus:bg-white rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest leading-none">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 4500.00"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 focus:bg-white rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest leading-none">Localização</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: São Paulo, SP"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 focus:bg-white rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest leading-none">Marca</label>
                  <select
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Xiaomi">Xiaomi</option>
                    <option value="Motorola">Motorola</option>
                    <option value="Google">Google</option>
                    <option value="Outros">Outras Marcas</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest leading-none">Modelo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: iPhone 14 Pro Max"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 focus:bg-white rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest leading-none">Armazenamento</label>
                  <input
                    type="text"
                    placeholder="Ex: 128GB, 256GB"
                    value={editStorage}
                    onChange={(e) => setEditStorage(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 focus:bg-white rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest leading-none">Saúde da Bateria (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Ex: 87"
                    value={editBatteryHealth}
                    onChange={(e) => setEditBatteryHealth(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 focus:bg-white rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest leading-none">Descrição dos Detalhes</label>
                <textarea
                  placeholder="Descreva a condição estética, detalhes de uso, se acompanha carregador original, nota fiscal..."
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/50 focus:bg-white rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAd(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition cursor-pointer active:scale-95 duration-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl shadow-md transition cursor-pointer active:scale-95 duration-100 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
