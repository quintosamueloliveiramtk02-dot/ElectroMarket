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
        "chatRoomId" TEXT,
        "senderId" TEXT NOT NULL,
        "text" TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[DB-Init] Successfully verified/created "Message" table.');

    try {
      // In physical PG, tables or index columns may be mixed case. Let's do a case-insensitive check and rename
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE lower(table_name)='message' AND lower(column_name)='chatid'
          ) AND NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE lower(table_name)='message' AND lower(column_name)='chatroomid'
          ) THEN
            ALTER TABLE "Message" RENAME COLUMN "chatId" TO "chatRoomId";
          END IF;
        END $$;
      `);
      console.log('[DB-Init] Checked and renamed chatId to chatRoomId in Message table if needed.');
    } catch (colErr: any) {
      console.warn('[DB-Init] Columns check/rename skipped or not supported:', colErr.message || colErr);
    }

    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "chatRoomId" TEXT;'
      );
      console.log('[DB-Init] Checked/Ensured "chatRoomId" column exists in Message table.');
    } catch (alterErr: any) {
      console.warn('[DB-Init] Ensure "chatRoomId" column step skipped:', alterErr.message || alterErr);
    }

    try {
      // Sync chatId to chatRoomId if both exist (backwards compatibility fallback)
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE lower(table_name)='message' AND lower(column_name)='chatid'
          ) AND EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE lower(table_name)='message' AND lower(column_name)='chatroomid'
          ) THEN
            UPDATE "Message" SET "chatRoomId" = "chatId" WHERE "chatRoomId" IS NULL AND "chatId" IS NOT NULL;
          END IF;
        END $$;
      `);
      console.log('[DB-Init] Checked and synced existing values of chatId to chatRoomId.');
    } catch (syncErr: any) {
      console.warn('[DB-Init] Sync legacy data step skipped:', syncErr.message || syncErr);
    }

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
