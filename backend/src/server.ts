import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import adRoutes from './routes/adRoutes';
import chatRoutes from './routes/chatRoutes';
import prisma from './lib/prisma';
import { syncUser } from './controllers/authController';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP Server
const server = http.createServer(app);

// Integrate Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*', // Permite que qualquer cliente conecte (comum para desenvolvimento)
    methods: ['GET', 'POST'],
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Auth, Ads & Chat routes registration
app.use('/api/auth', authRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/chats', chatRoutes);
app.post('/api/users/sync', syncUser);

// Secure database check endpoint
app.get('/api/debug-db', (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.json({
      status: 'error',
      message: 'DATABASE_URL is not set on process.env on Render'
    });
  }
  
  // Mask password for safety
  let maskedUrl = dbUrl;
  try {
    const parsed = new URL(dbUrl);
    parsed.password = '********';
    maskedUrl = parsed.toString();
  } catch (e: any) {
    maskedUrl = dbUrl.substring(0, Math.min(15, dbUrl.length)) + '... (invalid URL format: ' + e.message + ')';
  }

  res.json({
    status: 'configured',
    maskedUrl,
    startsWithPostgres: dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'),
    length: dbUrl.length,
    characterOneToFive: dbUrl.substring(0, 5)
  });
});

// Base Route
app.get('/', (req, res) => {
  res.json({
    message: 'ElectroMarket Backend successfully configured!',
    status: 'online',
    version: '1.0.0',
    documentationUrl: '/api/docs'
  });
});

// Initial API health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// Socket.io real-time connection handler
io.on('connection', (socket) => {
  console.log(`[Socket.io] Novo cliente conectado: ${socket.id}`);

  // Evento para entrar em um canal de conversa privado
  socket.on('join_room', (chatId: string) => {
    socket.join(chatId);
    console.log(`[Socket.io] Cliente ${socket.id} entrou no chat (sala): ${chatId}`);
  });

  // Evento para envio de mensagens em tempo real
  socket.on('send_message', async (data: { chatId: string; senderId: string; text: string }) => {
    const { chatId, senderId, text } = data;

    try {
      // Salva no banco de dados através do Prisma
      const message = await prisma.message.create({
        data: {
          chatId,
          senderId,
          text,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      });

      // Retransmite imediatamente para todos os os participantes na mesma sala do Chat
      io.to(chatId).emit('receive_message', message);
      console.log(`[Socket.io] Mensagem recebida de ${senderId} na sala ${chatId}: ${text}`);
    } catch (error: any) {
      console.error('[Socket.io] Erro ao processar mensagem enviada:', error.message);
    }
  });

  // Evento de desconexão
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`[ElectroMarket Server] Running with Socket.io on port ${PORT}`);
});
