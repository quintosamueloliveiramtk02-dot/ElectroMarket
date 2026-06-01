'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { supabase } from '../../../lib/supabaseClient';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import Navbar from '../../../components/Navbar';
import { 
  MessageSquare, 
  Send, 
  User as UserIcon, 
  Smartphone, 
  Calendar, 
  ArrowLeft,
  ChevronLeft,
  Battery,
  MapPin,
  CircleDot,
  ShoppingBag,
  ExternalLink,
  Info
} from 'lucide-react';

interface ChatUser {
  id: string;
  name: string;
  avatarUrl: string;
  phone?: string;
  email?: string;
}

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.trim().charAt(0).toUpperCase();
};

const getAvatarColor = (identifier: string) => {
  if (!identifier) return 'bg-blue-600';
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-505',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

interface ChatProduct {
  id: string;
  title: string;
  price: number;
  images: string[];
  brand?: string;
  model?: string;
}

interface ChatListItem {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  createdAt: string;
  product?: ChatProduct;
  buyer?: ChatUser;
  seller?: ChatUser;
  messages?: Array<{ id: string; text: string; createdAt: string }>;
}

interface MessageWithSender {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatarUrl: string;
  };
}

export default function ChatDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  
  // Dynamic Route chat identifier
  const chatId = (params?.id as string) || '';

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [inputText, setInputText] = useState<string>('');
  
  const [loadingChats, setLoadingChats] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Authentication Access Guard
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Chat privado requer login de usuário. Redirecionando...');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load user chats list (for Left Column chat list visual)
  useEffect(() => {
    if (!user) return;

    const fetchChatsList = async () => {
      try {
        setLoadingChats(true);
        const data = await api.get<ChatListItem[]>('/chats');
        setChats(data);
      } catch (err) {
        console.error('Erro ao buscar lista de negociações ativas:', err);
      } finally {
        setLoadingChats(false);
      }
    };

    fetchChatsList();
  }, [user]);

  // Initializing Socket.io Connection & Room Registration
  useEffect(() => {
    if (!user || !chatId) return;

    // Connect to WebSocket backend server
    const socketUrl = 'http://localhost:5000';
    console.log('[Socket.io] Conectando a:', socketUrl);
    
    const socket = io(socketUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.io] Conexão estabelecida com sucesso. Socket ID:', socket.id);
      setIsSocketConnected(true);
      
      // Request server to place user inside the current active chat room channel
      socket.emit('join_room', chatId);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Conexão perdida com o servidor.');
      setIsSocketConnected(false);
    });

    // Cleanup socket subscription to guard memory leaks and duplicated connections
    return () => {
      console.log('[Socket.io] Desmontando componente. Fechando conexão:', socket.id);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, chatId]);

  // Fetching message history from real database via HTTP endpoint
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    setMessages([]);
    setLoadingMessages(true);

    const fetchHistory = async () => {
      try {
        const data = await api.get<any>(`/chats/rooms/${chatId}/messages`);
        
        let messagesArray: MessageWithSender[] = [];
        if (data) {
          if (Array.isArray(data)) {
            messagesArray = data;
          } else if (typeof data === 'object') {
            if (Array.isArray(data.messages)) {
              messagesArray = data.messages;
            } else if (Array.isArray(data.data)) {
              messagesArray = data.data;
            } else if (data.data && Array.isArray(data.data.messages)) {
              messagesArray = data.data.messages;
            }
          }
        }
        
        setMessages(messagesArray);
        scrollToBottom();
      } catch (err) {
        console.error('Erro ao carregar histórico de mensagens via HTTP:', err);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchHistory();
  }, [chatId]);

  // Escuta em tempo real do Supabase v2 para Message
  useEffect(() => {
    if (!chatId) return;

    console.log("Iniciando assinatura Realtime para a sala:", chatId);

    const channel = supabase
      .channel(`room_messages_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `chatRoomId=eq.${chatId}`
        },
        (payload) => {
          console.log("Nova mensagem via Realtime:", payload);
          const newMessage = payload.new as any;

          setMessages((prev) => {
            if (prev.some(msg => msg.id === newMessage.id)) return prev;
            
            const formattedMsg = {
              ...newMessage,
              chatId: newMessage.chatRoomId || newMessage.chatId,
              chatRoomId: newMessage.chatRoomId || newMessage.chatId
            };
            return [...prev, formattedMsg];
          });
          scrollToBottom();
        }
      )
      .subscribe((status) => {
        console.log("Status da assinatura Realtime:", status);
      });

    return () => {
      console.log("Removendo canal da sala:", chatId);
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send communication message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || !chatId || !user || !socketRef.current) return;

    try {
      // Emit the socket event to push message into real-time pipeline to peer buyer/seller
      socketRef.current.emit('send_message', {
        chatId: chatId,
        senderId: user.id,
        text: textToSend,
      });

      // Instantly update localized state for fluid reactive rendering before backend confirmation
      const temporaryId = `tempid-${Date.now()}`;
      const mockMessageObj: MessageWithSender = {
        id: temporaryId,
        chatId: chatId,
        senderId: user.id,
        text: textToSend,
        createdAt: new Date().toISOString(),
        sender: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl || ''
        }
      };

      setMessages(prev => [...prev, mockMessageObj]);
      
      // Update sidebar list for instant responsiveness
      setChats(prevChats => 
        prevChats.map(c => c.id === chatId ? { ...c, messages: [{ id: temporaryId, text: textToSend, createdAt: new Date().toISOString() }] } : c)
      );

      setInputText('');
      scrollToBottom();
    } catch (err) {
      console.error('Falha ao enviar mensagem pelo pipeline socket:', err);
    }
  };

  const activeChat = chats.find((c) => c.id === chatId);

  // Helper resolving opponent contact object details
  const getOtherParticipant = (chat: ChatListItem) => {
    if (!user) return { name: 'Usuário', avatarUrl: '' };
    const isBuyer = user.id === chat.buyerId;
    const isSeller = user.id === chat.sellerId;
    
    const partner = isBuyer ? chat.seller : isSeller ? chat.buyer : (chat.seller || chat.buyer);
    return partner || { name: 'Contato', avatarUrl: '', email: '', phone: '(11) 99999-9999' };
  };

  const otherUser = activeChat ? getOtherParticipant(activeChat) : null;
  const productInfo = activeChat?.product;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (authLoading || (!user && loadingChats)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-semibold text-slate-500 font-sans">Carregando detalhes do negociador...</p>
        </div>
         );
  }
}
 </div>
    </div>
  );
}
