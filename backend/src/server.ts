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
  socket.on('join_room', (chatRoomId: string) => {
    socket.join(chatRoomId);
    console.log(`[Socket.io] Cliente ${socket.id} entrou no chat (sala): ${chatRoomId}`);
  });

  // Evento para envio de mensagens em tempo real
  socket.on('send_message', async (data: { chatRoomId?: string; chatId?: string; senderId: string; text: string; id?: string; createdAt?: string; sender?: any }) => {
    const chatRoomId = data.chatRoomId || data.chatId || "";
    const { senderId, text, id } = data;

    try {
      let messageWithChatId: any;

      if (id) {
        // Se a mensagem já possui ID, significa que ela já foi persistida via HTTP POST no banco de dados.
        // Apenas retransmitimos para atualizar a tela dos outros usuários em tempo real de forma otimizada.
        messageWithChatId = {
          ...data,
          chatRoomId: chatRoomId,
          chatId: chatRoomId
        };
      } else {
        // Salva no banco de dados através do Prisma caso ainda não tenha sido criada via HTTP POST
        const message = await prisma.message.create({
          data: {
            chatRoomId: chatRoomId,
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

        messageWithChatId = {
          ...message,
          chatRoomId: message.chatRoomId,
          chatId: message.chatRoomId
        };
      }

      // Retransmite imediatamente para todos os os participantes na mesma sala do Chat
      io.to(chatRoomId).emit('receive_message', messageWithChatId);
      console.log(`[Socket.io] Mensagem retransmitida de ${senderId} na sala ${chatRoomId}: ${text}`);
    } catch (error: any) {
      console.error('[Socket.io] Erro ao processar mensagem enviada:', error.message);
    }
  });

  // Evento de desconexão
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

// Helper to auto-patch database columns if the migration wasn't applied on Render Postgres DB
async function runDatabasePatch() {
  try {
    console.log('[DB-Init] Checking and auto-patching database schema on startup...');
    
    // 1. Ensure hasWarranty column exists in Product table
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "hasWarranty" BOOLEAN DEFAULT false;'
    );
    console.log('[DB-Init] Successfully ensured "hasWarranty" column exists in Product table.');

    // 2. Ensure ChatRoom table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ChatRoom" (
        "id" TEXT PRIMARY KEY,
        "productId" TEXT NOT NULL,
        "buyerId" TEXT NOT NULL,
        "sellerId" TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[DB-Init] Successfully verified/created "ChatRoom" table.');

    // 3. Ensure unique index on ChatRoom
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoom_productId_buyerId_sellerId_key" 
      ON "ChatRoom"("productId", "buyerId", "sellerId");
    `);
    console.log('[DB-Init] Successfully verified unique index on "ChatRoom".');

    // 4. Ensure Message table exists with chatRoomId instead of chatId
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Message" (
        "id" TEXT PRIMARY KEY,
        "chatRoomId" TEXT NOT NULL REFERENCES "ChatRoom"("id") ON DELETE CASCADE,
        "senderId" TEXT NOT NULL,
        "text" TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[DB-Init] Successfully verified/created "Message" table.');

  } catch (error: any) {
    console.warn('[DB-Init] Warning during auto-patch schema execution (could be expected if Neon/RDS doesn\'t support, or on non-Postgres):', error.message || error);
  }
}

// Start server
const startServer = async () => {
  await runDatabasePatch();
  
  server.listen(PORT, () => {
    console.log(`[ElectroMarket Server] Running with Socket.io on port ${PORT}`);
  });
};

startServer();
