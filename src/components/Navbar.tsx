import React, { useState } from 'react';
import { Search, PlusCircle, LogIn, User as UserIcon, LogOut, Flame } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onAnnounceClick?: () => void;
  onLoginClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery = '',
  setSearchQuery,
  onAnnounceClick,
  onLoginClick,
}) => {
  const { user, logout } = useAuth();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    if (setSearchQuery) {
      setSearchQuery(value);
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <div className="bg-blue-600 p-2 rounded-xl text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Flame className="w-5 h-5 fill-white" />
            </div>
            <span className="text-xl font-bold font-sans tracking-tight text-slate-900">
              Electro<span className="text-blue-600">Market</span>
            </span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar iPhone, Galaxy, Pixels..."
              value={setSearchQuery ? searchQuery : localSearch}
              onChange={handleSearchChange}
              className="block w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:bg-white transition-all outline-none"
            />
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* User logged in state */}
                <button
                  type="button"
                  onClick={onAnnounceClick}
                  className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 active:scale-95 duration-150 shadow-md shadow-blue-500/10 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Anunciar</span>
                </button>

                <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                  <div className="flex items-center gap-2 group cursor-pointer">
                    <img
                      src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80px&h=80px&q=80'}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                    />
                    <div className="hidden lg:block text-left">
                      <p className="text-xs font-semibold text-slate-800 leading-tight block max-w-[120px] truncate">
                        {user.name}
                      </p>
                      <button
                        type="button"
                        onClick={logout}
                        className="text-[10px] text-slate-400 hover:text-red-500 font-medium transition flex items-center gap-0.5"
                      >
                        <LogOut className="w-3 h-3" />
                        Sair
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* User logged out state */
              <button
                type="button"
                onClick={onLoginClick}
                className="bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4 text-blue-600" />
                <span>Entrar</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;
