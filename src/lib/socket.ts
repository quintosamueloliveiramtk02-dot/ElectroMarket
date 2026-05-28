import { io, Socket } from "socket.io-client";

// Get raw API URL and extract base host for the socket server connection dynamically
const rawApiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = rawApiUrl.replace(/\/api$/, '').replace(/\/api\/$/, '') || 'http://localhost:5000';

console.log("[Socket.io] Inicializando cliente socket singleton apontando para:", SOCKET_URL);

// Inicializa a conexão de forma singleton, evitando reconectar a cada renderização do React
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false, // Só conecta quando o usuário de fato abrir o chat/fizer login
  transports: ['websocket', 'polling']
});
