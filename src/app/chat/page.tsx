'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';
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
  CircleDot
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

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  // Obter chatId inicial do query param (?id=xxx)
  const queryChatId = searchParams?.get('id') || '';

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>(queryChatId);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [inputText, setInputText] = useState<string>('');
  
  const [loadingChats, setLoadingChats] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Redireciona para login se não estiver logado
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Chat requer login. Redirecionando para login.');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Carrega a lista de chats do usuário
  useEffect(() => {
    if (!user) return;

    const fetchChatsList = async () => {
      try {
        setLoadingChats(true);
        const data = await api.get<ChatListItem[]>('/chats');
        setChats(data);
        
        // Se houver um chatId no query param, marca como ativo
        if (queryChatId) {
          setActiveChatId(queryChatId);
        } else if (data.length > 0 && !activeChatId) {
          // Opcional: Não ativa por padrão para mostrar estado de seleção amigável
        }
      } catch (err) {
        console.error('Erro ao buscar lista de conversas:', err);
      } finally {
        setLoadingChats(false);
      }
    };

    fetchChatsList();
  }, [user, queryChatId]);

  // Inicializa a conexão Socket.io
  useEffect(() => {
    if (!user) return;

    // Inicializar socket apontando para a porta do nosso backend
    const socketUrl = 'http://localhost:5000';
    const socket = io(socketUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.io] Conectado ao servidor de chat:', socket.id);
      setIsSocketConnected(true);
      
      // Se tiver uma sala ativa agora, realiza o join imediato
      if (activeChatId) {
        socket.emit('join_room', activeChatId);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Desconectado do servidor de chat');
      setIsSocketConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  // Entra na sala do socket toda vez que o Active Chat Id mudar, e busca mensagens via HTTP com polling de 3 segundos
  useEffect(() => {
    if (!activeChatId || !user) return;

    // Emitir ingresso via socket se conectado
    if (socketRef.current) {
      socketRef.current.emit('join_room', activeChatId);
    }

    // Carregar histórico de mensagens via HTTP
    const fetchHistory = async (isInitial = false) => {
      try {
        if (isInitial) setLoadingMessages(true);
        const data = await api.get<MessageWithSender[]>(`/chats/rooms/${activeChatId}/messages`);
        setMessages(data);
        if (isInitial) scrollToBottom();
      } catch (err) {
        console.error('Erro ao carregar histórico de mensagens:', err);
      } finally {
        if (isInitial) setLoadingMessages(false);
      }
    };

    fetchHistory(true);

    const interval = setInterval(() => {
      fetchHistory(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChatId, user]);

  // Ouvir o recebimento de novas mensagens em tempo real via canal de escuta do socket
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleReceiveMessage = (newMessage: MessageWithSender) => {
      if (newMessage.chatId === activeChatId) {
        setMessages((prev) => {
          // Garante idempotência: previne injeção da mesma mensagem caso chegue repetida
          if (prev.some((msg) => msg.id === newMessage.id)) return prev;

          // Se encontrar mensagem temporária enviada por nós com o mesmo texto, substitui pelo ID real do banco
          const tempIndex = prev.findIndex(
            (msg) => msg.id.startsWith('tempid-') && msg.senderId === newMessage.senderId && msg.text === newMessage.text
          );

          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = newMessage;
            return updated;
          }

          return [...prev, newMessage];
        });
        scrollToBottom();
      }

      // Atualizar a última mensagem na barra lateral se couber
      setChats((prevChats) => {
        return prevChats.map((chat) => {
          if (chat.id === newMessage.chatId) {
            return {
              ...chat,
              messages: [{ id: newMessage.id, text: newMessage.text, createdAt: newMessage.createdAt }]
            };
          }
          return chat;
        });
      });
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [activeChatId]);

  // Rolar para a última mensagem
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Enviar uma nova mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText || !activeChatId || !user || !socketRef.current) return;

    try {
      // 1. Envia em tempo real via Socket para o outro usuário
      socketRef.current.emit('send_message', {
        chatId: activeChatId,
        senderId: user.id,
        text: cleanText,
      });

      // 2. Atualiza a tela local imediatamente com o dado real
      const temporaryId = `tempid-${Date.now()}`;
      const mockMessageObj: MessageWithSender = {
        id: temporaryId,
        chatId: activeChatId,
        senderId: user.id,
        text: cleanText,
        createdAt: new Date().toISOString(),
        sender: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl || ''
        }
      };

      setMessages((prev) => [...prev, mockMessageObj]);

      // Atualizar barra lateral instantaneamente com a mensagem recente
      setChats((prevChats) =>
        prevChats.map((c) =>
          c.id === activeChatId
            ? { ...c, messages: [{ id: temporaryId, text: cleanText, createdAt: new Date().toISOString() }] }
            : c
        )
      );

      // Limpar o campo de input
      setInputText('');
      scrollToBottom();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  // Encontra informações do chat atualmente ativo
  const activeChat = chats.find((c) => c.id === activeChatId);

  // Determinar com quem o usuário está conversando (outro participante)
  const getOtherParticipant = (chat: ChatListItem) => {
    if (!user) return { name: 'Usuário', avatarUrl: '' };
    return chat.buyerId === user.id ? chat.seller : chat.buyer;
  };

  const otherUser = activeChat ? getOtherParticipant(activeChat) : null;
  const productInfo = activeChat?.product;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-semibold text-slate-500">Iniciando segurança de acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto p-0 sm:p-4 md:p-6 lg:p-8 flex gap-4 overflow-hidden h-[calc(100vh-64px)]">
        
        {/* COLUNA ESQUERDA - Sidebar com conversas (Visível no mobile se não houver chat selecionado) */}
        <div className={`w-full lg:w-96 bg-white border border-slate-200 rounded-none sm:rounded-2xl shadow-sm flex flex-col shrink-0 overflow-hidden ${
          activeChatId ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* Header da Sidebar */}
          <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-white">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 font-sans">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                Mensagens
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wider">
                Chats de Negociação
              </p>
            </div>
            
            {/* Indicador de Status real-time */}
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              isSocketConnected 
                ? 'bg-emerald-50 text-emerald-600' 
                : 'bg-amber-50 text-amber-600'
            }`}>
              <CircleDot className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
              <span>{isSocketConnected ? 'Online' : 'Conectando'}</span>
            </div>
          </div>

          {/* Lista de Conversas Ativas */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingChats ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-[11px] text-slate-450 font-semibold">Buscando suas negociações...</p>
              </div>
            ) : chats.length === 0 ? (
              <div className="p-8 text-center space-y-3 max-w-[280px] mx-auto mt-12">
                <MessageSquare className="w-8 h-8 text-slate-350 mx-auto" />
                <h3 className="text-xs font-bold text-slate-700">Sem conversas ativas</h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Visite a vitrine e clique em "Conversar com o Vendedor" em qualquer iPhone ou aparelho de interesse para iniciar um chat privado seguro.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-block"
                >
                  Ver aparelhos disponíveis
                </button>
              </div>
            ) : (
              chats.map((chat) => {
                const other = getOtherParticipant(chat);
                const isSelected = chat.id === activeChatId;
                const lastMsg = chat.messages?.[0]?.text || 'Conversa iniciada recentemente.';

                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      // Opcional: Atualizar a URL sutilmente
                      router.replace(`/chat?id=${chat.id}`);
                    }}
                    className={`p-4 flex items-start gap-3 cursor-pointer transition select-none ${
                      isSelected 
                        ? 'bg-blue-50/50 border-l-4 border-l-blue-600' 
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Avatar do Destinatário */}
                    <img
                      src={other?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=48&h=48&q=80'}
                      alt={other?.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-150 shrink-0"
                    />

                    {/* Informações Textuais Pré-visualizáveis */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 truncate">
                          {other?.name || 'Anunciante'}
                        </span>
                        <span className="text-[9px] text-slate-400 whitespace-nowrap">
                          {chat.product?.brand || 'Smartphone'}
                        </span>
                      </div>
                      
                      {/* Título do produto em negociação */}
                      <p className="text-[10px] text-blue-600 font-bold truncate leading-tight mt-0.5">
                        {chat.product?.title || 'Aparelho do anunciante'}
                      </p>

                      {/* Preview da última mensagem trocada */}
                      <p className="text-xs text-slate-450 truncate mt-1 leading-normal font-sans">
                        {lastMsg}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* COLUNA DIREITA - Painel de Entrada de Mensagens (Ocultado no mobile se nenhum chat estiver ativo) */}
        <div className={`flex-1 bg-white border border-slate-200 rounded-none sm:rounded-2xl shadow-sm flex flex-col overflow-hidden ${
          !activeChatId ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {activeChatId && activeChat ? (
            <>
              {/* TOPO DA CONVERSA - Cabeçalho do Vendedor & Produto em foco */}
              <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-white z-10">
                <div className="flex items-center gap-3">
                  {/* Botão voltar visível apenas no Mobile */}
                  <button
                    onClick={() => {
                      setActiveChatId('');
                      router.replace('/chat');
                    }}
                    className="p-1 px-2 -ml-1 text-slate-500 hover:text-slate-900 border border-slate-150 bg-slate-50 hover:bg-slate-100 rounded-lg lg:hidden transition mr-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <img
                    src={otherUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&h=64&q=80'}
                    alt={otherUser?.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-slate-100"
                  />

                  <div>
                    <h3 className="text-xs font-black text-slate-900">{otherUser?.name}</h3>
                    
                    {/* Linha do Produto associado */}
                    {productInfo && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Smartphone className="w-3 h-3 text-blue-600 shrink-0" />
                        <span className="text-[10px] text-blue-600 font-bold truncate max-w-[200px] sm:max-w-xs hover:underline cursor-pointer" onClick={() => router.push(`/ads/${productInfo.id}`)}>
                          {productInfo.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({formatCurrency(productInfo.price)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Localização ou Detalhe Extra */}
                {productInfo?.model && (
                  <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>{productInfo.brand}</span>
                    <span>•</span>
                    <span>{productInfo.model}</span>
                  </div>
                )}
              </div>

              {/* CENTRO DA CONVERSA - Lista de Mensagens Rolável */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/40 space-y-3.5 flex flex-col">
                {loadingMessages ? (
                  <div className="flex-1 flex flex-col justify-center items-center p-8 space-y-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Carregando histórico...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-8 max-w-sm mx-auto space-y-2">
                    <div className="bg-blue-50/80 p-3 rounded-full text-blue-600 border border-blue-100">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-700">Inicie o diálogo!</h4>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Cumprimente o vendedor para verificar se o aparelho está livre para retirada, o estado de conservação ou saúde da bateria real.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMyMessage = user && msg.senderId === user.id;
                    const dateFormatted = new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[75%] sm:max-w-[65%] ${
                          isMyMessage ? 'self-end items-end' : 'self-start items-start'
                        }`}
                      >
                        {/* Remetente no balão do outro usuário */}
                        {!isMyMessage && (
                          <span className="text-[9px] text-slate-400 font-bold ml-2 mb-1">
                            {msg.sender?.name || otherUser?.name}
                          </span>
                        )}

                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed font-sans shadow-xs ${
                          isMyMessage
                            ? 'bg-blue-600 text-white rounded-tr-xs'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>

                        {/* Data / Hora de Envio */}
                        <span className="text-[9px] text-slate-400 font-semibold mt-1 px-1 tracking-wider uppercase">
                          {dateFormatted}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* RODAPÉ DA CONVERSA - Campo para Digitação */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-150 bg-white flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Escreva sua mensagem aqui para negociar..."
                  value={inputText}
                  disabled={loadingMessages}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="flex items-center justify-center p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-350 text-white rounded-xl transition cursor-pointer active:scale-95 shrink-0 shadow-md shadow-blue-500/10"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* ESTADO PADRÃO - Sem nenhum chat selecionado */
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 bg-slate-50/25">
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-center items-center max-w-sm space-y-4">
                <div className="p-3 bg-blue-50 rounded-full text-blue-600 border border-blue-100">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Selecione uma Conversa</h3>
                  <p className="text-xs text-slate-450 mt-1.5 leading-relaxed">
                    Escolha uma das negociações de celulares ativos listadas na barra lateral para abrir a janela de chat, ver fotos do smartphone, e concluir a compra com total segurança.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
