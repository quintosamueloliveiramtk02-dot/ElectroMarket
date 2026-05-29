import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  MessageSquare, 
  Smartphone, 
  Clock, 
  Phone, 
  User as UserIcon, 
  ChevronLeft, 
  Search,
  Check,
  CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Product, Chat, Message } from "../types";

interface ChatWindowProps {
  currentUser: User | null;
  chats: Chat[];
  messages: Message[];
  products: Product[];
  users: User[];
  onSendMessage: (chatRoomId: string, text: string) => void;
  selectedChatIdFromRoute: string | null;
}

export default function ChatWindow({
  currentUser,
  chats,
  messages,
  products,
  users,
  onSendMessage,
  selectedChatIdFromRoute
}: ChatWindowProps) {
  const [activeChatRoomId, setActiveChatRoomId] = useState<string | null>(null);
  const [typedMessage, setTypedMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Default fallback avatar
  const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120px&h=120px&q=80";

  // Auto-scroll to the end of messages when activeChatRoomId or messages list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatRoomId, messages]);

  // Sync active chat when a specific route chatId or productId comes in
  useEffect(() => {
    if (selectedChatIdFromRoute) {
      setActiveChatRoomId(selectedChatIdFromRoute);
      setShowMobileList(false); // On mobile, go straight to the chat area if chat is selected
    } else if (chats.length > 0 && !activeChatRoomId) {
      // By default open the first chat on desktop
      const initialChatRoomId = chats[0].chatRoomId || chats[0].id;
      setActiveChatRoomId(initialChatRoomId);
    }
  }, [selectedChatIdFromRoute, chats, activeChatRoomId]);

  // Get active chat object
  const activeChat = chats.find(c => (c.chatRoomId || c.id) === activeChatRoomId);

  // Helper to find the other user in the chat (Buyer vs Seller)
  const getChatPartner = (chat: Chat): User => {
    const isBuyer = currentUser?.id === chat.buyerId;
    const partnerId = isBuyer ? chat.sellerId : chat.buyerId;
    const partner = users.find(u => u.id === partnerId);
    
    return partner || {
      id: partnerId,
      name: isBuyer ? "Vendedor" : "Comprador",
      email: "",
      phone: "(11) 99999-9999",
      avatarUrl: defaultAvatar,
      createdAt: ""
    };
  };

  // Helper to find the product associated with a chat
  const getChatProduct = (chat: Chat): Product => {
    const prod = products.find(p => p.id === chat.productId);
    return prod || {
      id: chat.productId,
      userId: chat.sellerId,
      title: "Smartphone Inspecionado",
      description: "",
      price: 0,
      brand: "Celular",
      model: "Modelo",
      images: ["https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=300"],
      location: "São Paulo, SP",
      isFeatured: false,
      createdAt: ""
    };
  };

  // Helper to obtain the last message in a chat
  const getLastMessage = (chatRoomId: string): Message | null => {
    const chatMsgs = messages.filter(m => (m.chatRoomId || m.chatId) === chatRoomId);
    if (chatMsgs.length === 0) return null;
    return chatMsgs[chatMsgs.length - 1];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeChatRoomId) return;

    onSendMessage(activeChatRoomId, typedMessage.trim());
    setTypedMessage("");
  };

  // Filter chats by contact name or smartphone model
  const filteredChats = chats.filter(chat => {
    const partner = getChatPartner(chat);
    const prod = getChatProduct(chat);
    const chatRoomId = chat.chatRoomId || chat.id;
    const lastMsg = getLastMessage(chatRoomId)?.text || "";

    const cleanQuery = searchQuery.toLowerCase();
    return (
      partner.name.toLowerCase().includes(cleanQuery) ||
      prod.title.toLowerCase().includes(cleanQuery) ||
      prod.model.toLowerCase().includes(cleanQuery) ||
      lastMsg.toLowerCase().includes(cleanQuery)
    );
  });

  return (
    <div 
      className="flex flex-1 overflow-hidden bg-slate-50 border border-slate-200/60 rounded-2xl shadow-sm h-[calc(100vh-140px)] min-h-[500px]"
      id="chat-split-view-container"
    >
      
      {/* LEFT PANEL: Chat / Contacts List */}
      <div 
        className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 ${
          showMobileList ? "block" : "hidden md:flex"
        }`}
        id="chat-left-contacts-panel"
      >
        {/* Contacts Header */}
        <div className="p-4 border-b border-slate-150">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <span>Negociações Ativas</span>
            <span className="bg-slate-100 text-slate-600 text-xs py-0.5 px-2.5 rounded-full font-bold">
              {chats.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Converse com compradores e vendedores</p>

          {/* Search Box */}
          <div className="relative mt-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Pesquisar contatos ou aparelhos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-600/20 focus:bg-white focus:border-blue-600 transition-all"
            />
          </div>
        </div>

        {/* Contacts List Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100" id="contacts-list-viewport">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold">Nenhuma negociação encontrada</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Inicie conversas a partir dos anúncios do catálogo!</p>
            </div>
          ) : (
            filteredChats.map(chat => {
              const chatRoomId = chat.chatRoomId || chat.id;
              const partner = getChatPartner(chat);
              const prod = getChatProduct(chat);
              const lastMsg = getLastMessage(chatRoomId);
              const isActive = chatRoomId === activeChatRoomId;

              return (
                <button
                  key={chatRoomId}
                  onClick={() => {
                    setActiveChatRoomId(chatRoomId);
                    setShowMobileList(false); // Switch view to chat on mobile
                  }}
                  className={`w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer relative ${
                    isActive ? "bg-blue-50/50 hover:bg-blue-50/70 block-active-border" : ""
                  }`}
                  id={`contact-item-${chatRoomId}`}
                >
                  {/* Left accent line for active contact */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r" />
                  )}

                  {/* Partner Avatar */}
                  <div className="relative shrink-0">
                    <img 
                      src={partner.avatarUrl || defaultAvatar} 
                      alt={partner.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-205 shadow-sm"
                    />
                    {/* Device Miniature overlay flag badge */}
                    <div className="absolute -bottom-1 -right-1 bg-white border border-slate-200 rounded p-0.5 shadow-sm">
                      <img 
                        src={prod.images?.[0] || "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=80"} 
                        alt="Mini foto-smartphone" 
                        className="w-4.5 h-4.5 object-cover rounded"
                      />
                    </div>
                  </div>

                  {/* Content snippet */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="text-xs font-bold text-slate-800 truncate pr-2">
                        {partner.name}
                      </h4>
                      {lastMsg && (
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>

                    {/* Smartphone Model Header Label */}
                    <p className="text-[11px] font-semibold text-slate-500 truncate mb-1">
                      {prod.title}
                    </p>

                    {/* Last message text */}
                    <p className="text-xs text-slate-400 truncate pr-1">
                      {lastMsg ? lastMsg.text : "Inicie sua proposta..."}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Chat Area / Messages View */}
      <div 
        className={`flex-1 flex flex-col bg-slate-100 min-w-0 ${
          showMobileList ? "hidden md:flex" : "flex"
        }`}
        id="chat-right-messages-panel"
      >
        <AnimatePresence mode="wait">
          {activeChat ? (
            <motion.div 
              key={activeChat.chatRoomId || activeChat.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
              className="flex-grow flex flex-col min-h-0"
              id="messages-active-view"
            >
              {/* Chat Window Active Header */}
              <div className="bg-white border-b border-slate-200 p-4 shrink-0 flex items-center justify-between shadow-sm z-10" id="chat-header">
                <div className="flex items-center gap-3">
                  {/* Mobile Back Button */}
                  <button 
                    onClick={() => setShowMobileList(true)}
                    className="md:hidden p-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 mr-1"
                    title="Menu de contatos"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <img 
                    src={getChatPartner(activeChat).avatarUrl || defaultAvatar}
                    alt={getChatPartner(activeChat).name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <h3 className="font-title font-bold text-sm text-slate-900 leading-tight">
                      {getChatPartner(activeChat).name}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{getChatPartner(activeChat).phone || "(11) 98765-4321"}</span>
                    </div>
                  </div>
                </div>

                {/* Smartphone Card summary header */}
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 p-1.5 px-3 rounded-xl max-w-sm shrink-0">
                  <img 
                    src={getChatProduct(activeChat).images?.[0]} 
                    alt="Smartphone" 
                    className="w-8 h-8 rounded object-cover border border-slate-200"
                  />
                  <div className="text-left hidden sm:block">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Aparelho</span>
                    <span className="text-xs font-bold text-slate-800 leading-none truncate max-w-[150px] inline-block">
                      {getChatProduct(activeChat).model} - {getChatProduct(activeChat).storage || "128GB"}
                    </span>
                  </div>
                  <div className="text-right border-l border-slate-200 pl-2.5">
                    <span className="text-xs font-extrabold text-blue-600 block">
                      R$ {getChatProduct(activeChat).price.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Message Box viewport */}
              <div 
                className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50 messages-grid-bg scrollbar-thin scrollbar-thumb-slate-200"
                id="messages-viewport"
              >
                {/* Intro announcement badge */}
                <div className="flex justify-center my-2">
                  <div className="bg-blue-50 border border-blue-105 text-blue-700 rounded-xl p-3 text-xs text-center max-w-md shadow-sm">
                    <span className="font-bold uppercase tracking-wider text-[9px] block text-blue-800 mb-1">Dica de Segurança ElectroMarket</span>
                    <p className="leading-normal font-sans">
                      Dê preferência para transações presenciais em shoppings ou postos policiais por segurança. Sempre verifique o IMEI e o bloqueio de iCloud/Conta Google antes de pagar.
                    </p>
                  </div>
                </div>

                {/* Smartphone details spec tag banner above first message */}
                <div className="flex justify-center my-1.5">
                  <div className="bg-white border border-slate-150 rounded-lg p-2 flex items-center gap-2 text-[11px] text-slate-500 font-mono shadow-xs">
                    <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                    <span>Iniciando negociação para <strong>{getChatProduct(activeChat).title}</strong> ({getChatProduct(activeChat).brand})</span>
                  </div>
                </div>

                {/* Message display listing */}
                {messages
                  .filter(m => (m.chatRoomId || m.chatId) === (activeChat.chatRoomId || activeChat.id))
                  .map((msg, index) => {
                    const isMe = msg.senderId === currentUser?.id || msg.senderId === "user-buyer-1";
                    
                    return (
                      <div 
                        key={msg.id || index}
                        className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
                      >
                        <div 
                          className={`max-w-[75%] rounded-2xl p-3 shadow-xs relative ${
                            isMe 
                            ? "bg-blue-600 text-white rounded-br-none" 
                            : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-none"
                          }`}
                        >
                          {/* Message text */}
                          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap pr-4 font-sans">
                            {msg.text}
                          </p>

                          {/* Message meta & status check overlay */}
                          <div className="flex items-center justify-end gap-1 text-[8.5px] opacity-70 mt-1 font-mono">
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isMe && (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-100 fill-transparent shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
                
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input submit form box */}
              <div className="p-3 bg-white border-t border-slate-200 shadow-lg shrink-0" id="chat-input-area">
                <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder="Faça sua proposta ou envie uma mensagem direta ao vendedor..."
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    className="flex-grow px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:shadow-sm transition-all"
                    id="chat-message-input-textbox"
                  />
                  <button 
                    type="submit" 
                    disabled={!typedMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white p-2.5 px-5 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold shadow-md cursor-pointer shrink-0"
                    id="chat-send-message-submit-button"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center" id="no-chat-selected-display">
              <div className="bg-white p-5 rounded-full shadow-sm border border-slate-200 mb-4 animate-bounce duration-1000">
                <MessageSquare className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="font-title font-bold text-slate-800 text-base leading-tight">Escolha uma Negociação</h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                Selecione uma conversa ativa no painel esquerdo ou visite o catálogo para negociar iPhones e aparelhos de excelente procedência!
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
