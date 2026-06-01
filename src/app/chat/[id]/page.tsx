'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { supabase } from '../../../lib/supabaseClient';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  MessageSquare, 
  Send, 
  ChevronLeft,
  CircleDot,
  ExternalLink,
  Info
} from 'lucide-react';

// Interfaces... (omitted for brevity in thought, but will include in file)
// ...

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  
  const chatId = (params?.id as string) || '';

  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState<string>('');
  
  const [loadingChats, setLoadingChats] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchChatsList = async () => {
      try {
        setLoadingChats(true);
        const data = await api.get<any[]>('/chats');
        setChats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingChats(false);
      }
    };
    fetchChatsList();
  }, [user]);

  useEffect(() => {
    if (!user || !chatId) return;
    const socketUrl = 'http://localhost:5000';
    const socket = io(socketUrl, { autoConnect: true });
    socketRef.current = socket;
    socket.on('connect', () => setIsSocketConnected(true));
    socket.emit('join_room', chatId);
    return () => { socket.disconnect(); };
  }, [user, chatId]);

  // Combined History Fetch and Realtime Listener
  useEffect(() => {
    if (!chatId) return;

    console.log("Mensagens no estado:", messages);

    const fetchHistory = async () => {
      try {
        setLoadingMessages(true);
        const data = await api.get<any>(`/chats/rooms/${chatId}/messages`);
        const initialMessages = data?.messages || data || [];
        setMessages(initialMessages);
      } catch (err) {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchHistory();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`room_messages_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message', filter: `chatRoomId=eq.${chatId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [chatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !chatId || !socketRef.current) return;
    socketRef.current.emit('send_message', { chatId, senderId: user?.id, text: inputText.trim() });
    setInputText('');
  };

  const activeChat = chats.find((c) => c.id === chatId);
  const otherUser = activeChat ? (user?.id === activeChat.buyerId ? activeChat.seller : activeChat.buyer) : null;
  const productInfo = activeChat?.product;

  if (authLoading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
        {/* HEADER */}
        <div className="p-4 border-b border-slate-150 flex items-center justify-between">
            <button onClick={() => router.push('/chat')}><ChevronLeft /></button>
            <span className="font-bold">{otherUser?.name || 'Chat'}</span>
            <span>{productInfo?.title}</span>
        </div>
        
        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">
            {messages.map((msg) => {
              const isMyMessage = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex flex-col w-full ${isMyMessage ? 'items-end' : 'items-start'}`}>
                  <div className={`p-3 rounded-lg w-fit max-w-[70%] ${isMyMessage ? 'bg-blue-600 text-white ml-auto' : 'bg-slate-100 text-slate-800 mr-auto'}`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-150 flex gap-2">
            <input value={inputText} onChange={(e) => setInputText(e.target.value)} className="flex-1 border rounded p-2" />
            <button type="submit"><Send /></button>
        </form>
    </div>
  );
}
