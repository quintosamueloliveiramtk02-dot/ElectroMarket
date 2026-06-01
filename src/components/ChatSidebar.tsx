'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, CircleDot } from 'lucide-react';

interface ChatUser {
  id: string;
  name: string;
  avatarUrl: string;
}

interface ChatListItem {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  createdAt: string;
  product?: { title: string; brand?: string };
  buyer?: ChatUser;
  seller?: ChatUser;
  messages?: Array<{ id: string; text: string; createdAt: string }>;
}

const getInitials = (name: string) => (!name ? 'U' : name.trim().charAt(0).toUpperCase());

const getAvatarColor = (identifier: string) => {
  if (!identifier) return 'bg-blue-600';
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];
  return colors[Math.abs(hash) % colors.length];
};

export default function ChatSidebar() {
  const router = useRouter();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchChatsList = async () => {
      try {
        setLoadingChats(true);
        const data = await api.get<ChatListItem[]>('/chats');
        setChats(data);
      } catch (err) {
        console.error('Erro ao buscar lista de conversas:', err);
      } finally {
        setLoadingChats(false);
      }
    };
    fetchChatsList();
  }, [user]);

  const getOtherParticipant = (chat: ChatListItem) => {
    if (!user) return { name: 'Usuário', avatarUrl: '' };
    const partner = user.id === chat.buyerId ? chat.seller : chat.buyer;
    return partner || { name: 'Contato', avatarUrl: '' };
  };

  return (
    <div className="w-80 xl:w-96 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col shrink-0 overflow-hidden">
      <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-white">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-blue-600" /> Negociações
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loadingChats ? (
            <div className="p-8 text-center text-xs text-slate-400">Carregando...</div>
        ) : chats.map((chat) => {
          const other = getOtherParticipant(chat);
          return (
            <div
              key={chat.id}
              onClick={() => router.push(`/chat/${chat.id}`)}
              className="p-4 hover:bg-slate-50 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(other.name)}`}>
                  {getInitials(other.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-slate-800 truncate">{other.name}</p>
                  <p className="text-[10px] text-blue-600 font-bold truncate">{chat.product?.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
