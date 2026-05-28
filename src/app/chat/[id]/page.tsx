'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
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
}

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
    if (!chatId || !user) return;

    const fetchHistory = async () => {
      try {
        setLoadingMessages(true);
        const data = await api.get<MessageWithSender[]>(`/chats/${chatId}/messages`);
        setMessages(data);
        scrollToBottom();
      } catch (err) {
        console.error('Erro ao carregar histórico de mensagens via HTTP:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchHistory();
  }, [chatId, user]);

  // Listening to real-time events triggered by server side broadcasts
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleReceiveMessage = (newMessage: MessageWithSender) => {
      // Check if received message belongs to currently opened chat channel
      if (newMessage.chatId === chatId) {
        setMessages((prev) => {
          // Idempotency: skip inserting if message is already stored in state
          if (prev.some((msg) => msg.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        scrollToBottom();
      }

      // Live-update last preview sentence in sidebar
      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id === newMessage.chatId) {
            return {
              ...chat,
              messages: [{ id: newMessage.id, text: newMessage.text, createdAt: newMessage.createdAt }]
            };
          }
          return chat;
        })
      );
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
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
    if (!user) return { name: 'Comprador', avatarUrl: '' };
    return chat.buyerId === user.id ? chat.seller : chat.buyer;
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
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto p-0 sm:p-4 md:p-6 lg:p-8 flex gap-4 overflow-hidden h-[calc(100vh-64px)]">
        
        {/* LEFT COLUMN - Conversas Ativas (Oculto em mobile) */}
        <div className="hidden lg:flex w-80 xl:w-96 bg-white border border-slate-200 rounded-2xl shadow-sm flex-col shrink-0 overflow-hidden">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-white">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 font-sans">
                <MessageSquare className="w-4 h-4 text-blue-600 animate-bounce" />
                Negociações
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wider">
                Lista de canais ativos
              </p>
            </div>
            
            {/* Realtime dot indicator */}
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              isSocketConnected 
                ? 'bg-emerald-50 text-emerald-600' 
                : 'bg-amber-50 text-amber-600'
            }`}>
              <CircleDot className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
              <span>{isSocketConnected ? 'Online' : 'Reconectando'}</span>
            </div>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingChats ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-[11px] text-slate-400 font-semibold font-sans">Buscando...</p>
              </div>
            ) : chats.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-2 mt-12">
                <MessageSquare className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">Sem conversas listadas</p>
              </div>
            ) : (
              chats.map((chat) => {
                const other = getOtherParticipant(chat);
                const isSelected = chat.id === chatId;
                const lastMessageText = chat.messages?.[0]?.text || 'Conversa iniciada recentemente.';

                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      router.push(`/chat/${chat.id}`);
                    }}
                    className={`p-4 flex items-start gap-3 cursor-pointer transition select-none ${
                      isSelected 
                        ? 'bg-blue-50/50 border-l-4 border-l-blue-600' 
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <img
                      src={other?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=48&h=48&q=80'}
                      alt={other?.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-150 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 truncate">
                          {other?.name || 'Vendedor'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-sans uppercase">
                          {chat.product?.brand || 'Premium'}
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-blue-600 font-bold truncate mt-0.5 leading-none">
                        {chat.product?.title}
                      </p>

                      <p className="text-xs text-slate-400 truncate mt-1 leading-normal font-medium font-sans">
                        {lastMessageText}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* RIGHT COLUMN - WhatsApp/Messenger Web layout */}
        <div className="flex-1 bg-white border border-slate-200 rounded-none sm:rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">
          
          {/* HEADER BAR - Chat opponent card + Product details sticky review */}
          <div className="p-3 sm:p-4 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between bg-white gap-3 z-10 shrink-0">
            <div className="flex items-center gap-3">
              
              {/* Back button redirects to /chat */}
              <button
                onClick={() => router.push('/chat')}
                className="p-1 px-1.5 text-slate-500 hover:text-slate-900 border border-slate-150 bg-slate-50 hover:bg-slate-100 rounded-lg transition mr-1"
                title="Voltar para todas as conversas"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <img
                src={otherUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&h=64&q=80'}
                alt={otherUser?.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-slate-150 shrink-0"
              />

              <div className="min-w-0">
                <span className="text-xs font-black text-slate-900 block leading-tight">{otherUser?.name || 'Vendedor ElectroMarket'}</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-0.5">Negociação Segura</span>
              </div>
            </div>

            {/* PRODUCT MINI CARD (Foto, título e preço) */}
            {productInfo && (
              <div 
                onClick={() => router.push(`/ads/${productInfo.id}`)}
                className="bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-xl p-2 flex items-center gap-2.5 max-w-[280px] sm:max-w-xs cursor-pointer select-none transition self-end sm:self-center shrink-0"
                title="Ver detalhes do smartphone na vitrine"
              >
                <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                  <img 
                    src={productInfo.images?.[0] || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=80&q=80'} 
                    alt={productInfo.title}
                    referrerPolicy="no-referrer" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[10px] font-bold text-slate-800 truncate leading-none mb-0.5">{productInfo.title}</h4>
                  <span className="text-[10px] text-blue-600 font-extrabold">{formatCurrency(productInfo.price)}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            )}
          </div>

          {/* CHAT CHRONOLOGY WINDOW - Auto scrolling viewport */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/40 space-y-4 flex flex-col min-h-0">
            
            {/* Info Security Tips */}
            <div className="bg-blue-50/70 border border-blue-105 rounded-xl p-3 flex items-start gap-2 max-w-lg mx-auto shadow-xs">
              <Info className="w-4.5 h-4.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-700 leading-normal font-sans">
                Para fechar o negócio com total transparência e segurança, utilize pagamento seguro
                marcando o aparelho como vendido. Dê preferência por transferências via PIX.
              </p>
            </div>

            {loadingMessages ? (
              <div className="flex-1 flex flex-col justify-center items-center p-8 space-y-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[11px] text-slate-400 font-medium font-sans uppercase tracking-wider">Carregando histórico do chat...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-grow flex flex-col justify-center items-center text-center p-10 max-w-sm mx-auto space-y-3">
                <div className="bg-blue-50 p-3 rounded-full text-blue-600 border border-blue-100 shadow-xs">
                  <MessageSquare className="w-6 h-6 animate-pulse" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 font-sans">Comece seu bate-papo comercial</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Envie uma proposta de compra à vista via PIX, combine dia e local de entrega pública, ou faça perguntas técnicas sobre o estado de conservação do celular.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMyMessage = user && msg.senderId === user.id;
                const timeStr = new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[80%] sm:max-w-[70%] ${
                      isMyMessage ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    {!isMyMessage && (
                      <span className="text-[9px] text-slate-400 font-bold ml-2 mb-1">
                        {msg.sender?.name || otherUser?.name}
                      </span>
                    )}

                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed font-sans shadow-xs ${
                      isMyMessage
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : 'bg-white text-slate-850 border border-slate-200 rounded-tl-xs'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>

                    <span className="text-[9px] text-slate-405 font-medium mt-1 px-1 font-sans">
                      {timeStr}
                    </span>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM - Sticky footer style with airplane paper icon */}
          <form 
            onSubmit={handleSendMessage} 
            className="p-3 border-t border-slate-150 bg-white flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder="Digite uma proposta ou tire dúvidas sobre o smartphone..."
              value={inputText}
              disabled={loadingMessages}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loadingMessages}
              className="flex items-center justify-center p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-xl transition cursor-pointer active:scale-95 shrink-0 shadow bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}
