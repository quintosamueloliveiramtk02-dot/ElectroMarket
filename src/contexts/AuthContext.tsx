import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string, avatarUrl?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Efeito ao inicializar o site para recuperar sessão salva
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const savedToken = localStorage.getItem('electromarket_token');
        const savedUser = localStorage.getItem('electromarket_user');

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Erro ao restaurar sessão de autenticação local:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Função para autenticar o usuário e iniciar sessão
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const data = await api.post<{ message: string; user: User; token: string }>('/auth/login', {
        email,
        password,
      });

      setToken(data.token);
      setUser(data.user);

      localStorage.setItem('electromarket_token', data.token);
      localStorage.setItem('electromarket_user', JSON.stringify(data.user));
    } catch (error: any) {
      throw new Error(error.message || 'Falha ao realizar login');
    }
  };

  // Função para registrar um novo usuário
  const register = async (
    name: string,
    email: string,
    password: string,
    phone?: string,
    avatarUrl?: string
  ): Promise<void> => {
    try {
      const data = await api.post<{ message: string; user: User; token: string }>('/auth/register', {
        name,
        email,
        password,
        phone: phone || '',
        avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120px&h=120px&q=80',
      });

      // Login automático após registrar com sucesso
      setToken(data.token);
      setUser(data.user);

      localStorage.setItem('electromarket_token', data.token);
      localStorage.setItem('electromarket_user', JSON.stringify(data.user));
    } catch (error: any) {
      throw new Error(error.message || 'Falha ao registrar conta');
    }
  };

  // Função para deslogar do sistema
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('electromarket_token');
    localStorage.removeItem('electromarket_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser utilizado dentro de um provider <AuthProvider />');
  }
  return context;
};
