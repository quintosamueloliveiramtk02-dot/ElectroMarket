'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { api } from '../../lib/api';

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const chats = await api.get<any[]>('/chats');
        if (chats && chats.length > 0) {
          router.replace(`/chat/${chats[0].id || chats[0].chatRoomId || chats[0].roomId}`);
        }
      } catch (err) {
        console.error('Erro ao buscar chat para redirect:', err);
      }
    };
    fetchChats();
  }, [router]);

  return (
    <div className="hidden lg:flex flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex-col justify-center items-center p-8 bg-slate-50/25">
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-center items-center max-w-sm space-y-4">
        <div className="p-3 bg-blue-50 rounded-full text-blue-600 border border-blue-100">
          <MessageSquare className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-black text-slate-900">Selecione uma Conversa</h3>
          <p className="text-xs text-slate-450 mt-1.5 leading-relaxed">
            Escolha uma das negociações na barra lateral para abrir a janela de chat.
          </p>
        </div>
      </div>
    </div>
  );
}
