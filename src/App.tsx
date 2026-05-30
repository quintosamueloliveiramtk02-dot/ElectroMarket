import React, { useState, useTransition, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { api } from './lib/api';
import {
  Smartphone,
  ChevronRight,
  PlusCircle,
  Search,
  ShoppingCart,
  User as UserIcon,
  MapPin,
  Flame,
  CheckCircle,
  Copy,
  Terminal,
  Database,
  FileCode,
  Server,
  MessageSquare,
  Globe,
  Plus,
  Send,
  Trash2,
  Lock,
  ArrowRight,
  Info,
  Check,
  Package,
  Pencil,
  Sparkles,
  RefreshCw,
  X,
  FileText,
  Clock,
  Loader2
} from 'lucide-react';
import { User, Product, Chat, Message } from './types';
import { supabase } from './lib/supabaseClient';
import ProductDetails from './components/ProductDetails';
import ChatWindow from './components/ChatWindow';
import ProductSkeletonGrid from './components/ProductSkeletonGrid';
import ProfilePage from './app/profile/page';
import { motion, AnimatePresence } from 'motion/react';

// Let's create the hardcoded database code representations to display & copy easily.
const SCHEMA_PRISMA_CODE = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  name         String
  avatarUrl    String?
  phone        String?
  createdAt    DateTime  @default(now())

  // Relations
  products     Product[]
  chatsAsBuyer Chat[]    @relation("BuyerChats")
  chatsAsSeller Chat[]   @relation("SellerChats")
  messages     Message[]
}

model Product {
  id            String   @id @default(uuid())
  userId        String
  title         String
  description   String
  price         Float
  brand         String
  model         String
  batteryHealth Int?
  storage       String?
  images        String[]
  location      String
  isFeatured    Boolean  @default(false)
  createdAt     DateTime @default(now())

  // Relations
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  chats         Chat[]
}

model Chat {
  id        String   @id @default(uuid())
  buyerId   String
  sellerId  String
  productId String
  createdAt DateTime @default(now())

  // Relations
  buyer     User      @relation("BuyerChats", fields: [buyerId], references: [id], onDelete: Cascade)
  seller    User      @relation("SellerChats", fields: [sellerId], references: [id], onDelete: Cascade)
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  messages  Message[]

  @@unique([buyerId, sellerId, productId])
}

model Message {
  id        String   @id @default(uuid())
  chatId    String
  senderId  String
  text      String
  createdAt DateTime @default(now())

  // Relations
  chat      Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)
  sender    User     @relation(fields: [senderId], references: [id], onDelete: Cascade)
}`;

const PACKAGE_JSON_CODE = `{
  "name": "electromarket-backend",
  "version": "1.0.0",
  "description": "Back-end structure for ElectroMarket, a premium electronics and smartphones marketplace",
  "main": "dist/server.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.12.12",
    "prisma": "^5.14.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5"
  }
}`;

const SERVER_TS_CODE = `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './src/routes/authRoutes';
import adRoutes from './src/routes/adRoutes';
import chatRoutes from './src/routes/chatRoutes';
import prisma from './src/lib/prisma';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP Server
const server = http.createServer(app);

// Integrate Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*',
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
  console.log(\`[Socket.io] Novo cliente conectado: \${socket.id}\`);

  // Evento para entrar em um canal de conversa privado
  socket.on('join_room', (chatId: string) => {
    socket.join(chatId);
    console.log(\`[Socket.io] Cliente \${socket.id} entrou no chat (sala): \${chatId}\`);
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
    } catch (error: any) {
      console.error('[Socket.io] Erro ao processar:', error.message);
    }
  });

  // Evento de desconexão
  socket.on('disconnect', () => {
    console.log(\`[Socket.io] Cliente desconectado: \${socket.id}\`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(\`[ElectroMarket Server] Running with Socket.io on port \${PORT}\`);
});`;

const AUTH_MIDDLEWARE_CODE = `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    res.status(401).json({ error: 'Erro no formato do token' });
    return;
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    res.status(401).json({ error: 'Token malformatado. Use o padrão "Bearer <token>"' });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-electromarket';

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string };
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }
};`;

const AUTH_CONTROLLER_CODE = `import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-electromarket';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone, avatarUrl } = req.body;

    // Campos obrigatórios de validação
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Campos obrigatórios ausentes (email, password, name)' });
      return;
    }

    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'Este e-mail já está cadastrado em nossa plataforma' });
      return;
    }

    // Criptografar a senha com o Bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Salvar o novo usuário no PostgreSQL via Prisma
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        avatarUrl,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
      }
    });

    // Gerar um Token JWT válido por 7 dias
    const token = jwt.sign({ id: user.id }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      message: 'Usuário registrado com sucesso!',
      user,
      token,
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Erro interno do servidor ao registrar usuário', 
      details: error.message 
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validar entradas
    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
      return;
    }

    // Verificar se o e-mail existe cadastrado
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: 'E-mail ou senha incorretos' });
      return;
    }

    // Comparar senhas com Bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'E-mail ou senha incorretos' });
      return;
    }

    // Gerar Token JWT válido por 7 dias
    const token = jwt.sign({ id: user.id }, JWT_SECRET, {
      expiresIn: '7d',
    });

    // Resposta de sucesso omitindo a hash de senha
    res.status(200).json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Erro interno do servidor ao realizar login', 
      details: error.message 
    });
  }
};`;

const AUTH_ROUTES_CODE = `import { Router } from 'express';
import { register, login } from '../controllers/authController';

const router = Router();

// Endpoints de autenticação conectados às respectivas funções
router.post('/register', register);
router.post('/login', login);

export default router;`;

const AD_CONTROLLER_CODE = `import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';

// 1. Criar um anúncio associado ao ID do usuário autenticado
export const createAd = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, price, brand, model, batteryHealth, storage, images, location, isFeatured } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado ou inválido' });
      return;
    }

    if (!title || !price || !brand || !model || !location) {
      res.status(400).json({ error: 'Campos obrigatórios ausentes (title, price, brand, model, location)' });
      return;
    }

    const priceFloat = parseFloat(price);
    if (isNaN(priceFloat)) {
      res.status(400).json({ error: 'O preço informado deve ser um número válido' });
      return;
    }

    const ad = await prisma.product.create({
      data: {
        userId,
        title,
        description: description || '',
        price: priceFloat,
        brand,
        model,
        batteryHealth: batteryHealth ? parseInt(batteryHealth, 10) : null,
        storage: storage || null,
        images: Array.isArray(images) ? images : [],
        location,
        isFeatured: !!isFeatured,
      }
    });

    res.status(201).json({
      message: 'Anúncio publicado com sucesso!',
      ad,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro interno ao publicar anúncio',
      details: error.message
    });
  }
};

// 2. Filtrar e listar todos os anúncios públicos
export const getAllAds = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { brand, minPrice, maxPrice, storage, search, isFeatured } = req.query;

    const whereClause: any = {};

    // Filtro por Marca
    if (brand && typeof brand === 'string') {
      whereClause.brand = {
        equals: brand,
        mode: 'insensitive',
      };
    }

    // Filtro por Armazenamento
    if (storage && typeof storage === 'string') {
      whereClause.storage = {
        equals: storage,
        mode: 'insensitive',
      };
    }

    // Filtro por Destaque
    if (isFeatured !== undefined) {
      whereClause.isFeatured = isFeatured === 'true' || isFeatured === '1';
    }

    // Faixa de Preço
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice && typeof minPrice === 'string') {
        const min = parseFloat(minPrice);
        if (!isNaN(min)) {
          whereClause.price.gte = min;
        }
      }
      if (maxPrice && typeof maxPrice === 'string') {
        const max = parseFloat(maxPrice);
        if (!isNaN(max)) {
          whereClause.price.lte = max;
        }
      }
    }

    // Filtro de Busca Geral (por Título, Descrição, Modelo)
    if (search && typeof search === 'string') {
      const searchTerms = search.trim();
      whereClause.OR = [
        { title: { contains: searchTerms, mode: 'insensitive' } },
        { description: { contains: searchTerms, mode: 'insensitive' } },
        { model: { contains: searchTerms, mode: 'insensitive' } },
      ];
    }

    const ads = await prisma.product.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          }
        }
      }
    });

    res.status(200).json(ads);
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao buscar anúncios',
      details: error.message
    });
  }
};

// 3. Buscar os detalhes de um anúncio específico e dados do vendedor
export const getAdById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const ad = await prisma.product.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          }
        }
      }
    });

    if (!ad) {
      res.status(404).json({ error: 'Anúncio não encontrado' });
      return;
    }

    res.status(200).json(ad);
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao buscar detalhes do anúncio',
      details: error.message
    });
  }
};

// 4. Atualizar as informações de um anúncio (Apenas o próprio dono)
export const updateAd = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { title, description, price, brand, model, batteryHealth, storage, images, location, isFeatured } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    // Buscar anúncio e validar propriedade
    const ad = await prisma.product.findUnique({
      where: { id }
    });

    if (!ad) {
      res.status(404).json({ error: 'Anúncio não encontrado' });
      return;
    }

    if (ad.userId !== userId) {
      res.status(403).json({ error: 'Você não tem permissão para editar este anúncio' });
      return;
    }

    // Preparar dados de atualização
    const updatedData: any = {};
    if (title !== undefined) updatedData.title = title;
    if (description !== undefined) updatedData.description = description;
    if (price !== undefined) {
      const priceFloat = parseFloat(price);
      if (!isNaN(priceFloat)) {
        updatedData.price = priceFloat;
      }
    }
    if (brand !== undefined) updatedData.brand = brand;
    if (model !== undefined) updatedData.model = model;
    if (batteryHealth !== undefined) {
      updatedData.batteryHealth = batteryHealth ? parseInt(batteryHealth, 10) : null;
    }
    if (storage !== undefined) updatedData.storage = storage || null;
    if (images !== undefined && Array.isArray(images)) updatedData.images = images;
    if (location !== undefined) updatedData.location = location;
    if (isFeatured !== undefined) updatedData.isFeatured = !!isFeatured;

    const updatedAd = await prisma.product.update({
      where: { id },
      data: updatedData
    });

    res.status(200).json({
      message: 'Anúncio atualizado com sucesso!',
      ad: updatedAd
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao atualizar o anúncio',
      details: error.message
    });
  }
};

// 5. Excluir anúncio (Apenas o próprio dono)
export const deleteAd = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    // Buscar anúncio e validar propriedade
    const ad = await prisma.product.findUnique({
      where: { id }
    });

    if (!ad) {
      res.status(404).json({ error: 'Anúncio não encontrado' });
      return;
    }

    if (ad.userId !== userId) {
      res.status(403).json({ error: 'Você não tem permissão para excluir este anúncio' });
      return;
    }

    await prisma.product.delete({
      where: { id }
    });

    res.status(200).json({
      message: 'Anúncio excluído com sucesso!'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao excluir o anúncio',
      details: error.message
    });
  }
};`;

const AD_ROUTES_CODE = `import { Router } from 'express';
import { createAd, getAllAds, getAdById, updateAd, deleteAd } from '../controllers/adController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Rotas públicas de consulta
router.get('/', getAllAds);
router.get('/:id', getAdById);

// Rotas privadas protegidas pelo authMiddleware
router.post('/', authMiddleware, createAd);
router.put('/:id', authMiddleware, updateAd);
router.delete('/:id', authMiddleware, deleteAd);

export default router;`;

const CHAT_CONTROLLER_CODE = `import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';

// 1. Verificar se já existe um chat ou criar um novo associando o comprador, vendedor e o produto
export const getOrCreateChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, sellerId: bodySellerId } = req.body;
    const buyerId = req.userId;

    if (!buyerId) {
      res.status(401).json({ error: 'Comprador não autenticado' });
      return;
    }

    if (!productId) {
      res.status(400).json({ error: 'O ID do produto (productId) é obrigatório' });
      return;
    }

    let sellerId = bodySellerId;
    if (!sellerId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { userId: true }
      });

      if (!product) {
        res.status(404).json({ error: 'Produto não encontrado' });
        return;
      }
      sellerId = product.userId;
    }

    if (buyerId === sellerId) {
      res.status(400).json({ error: 'Você não pode iniciar um chat com o seu próprio anúncio' });
      return;
    }

    let chat = await prisma.chat.findUnique({
      where: {
        buyerId_sellerId_productId: {
          buyerId,
          sellerId,
          productId
        }
      },
      include: {
        product: { select: { title: true, images: true, price: true } },
        seller: { select: { name: true, avatarUrl: true } },
        buyer: { select: { name: true, avatarUrl: true } }
      }
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: { buyerId, sellerId, productId },
        include: {
          product: { select: { title: true, images: true, price: true } },
          seller: { select: { name: true, avatarUrl: true } },
          buyer: { select: { name: true, avatarUrl: true } }
        }
      });
    }

    res.status(200).json(chat);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao obter ou criar sala de chat', details: error.message });
  }
};

// 2. Listar todas os chats em que o usuário está participando (como comprador ou vendedor)
export const getUserChats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    const chats = await prisma.chat.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      },
      include: {
        product: { select: { id: true, title: true, price: true, images: true, brand: true, model: true } },
        buyer: { select: { id: true, name: true, avatarUrl: true, phone: true } },
        seller: { select: { id: true, name: true, avatarUrl: true, phone: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(chats);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao listar chats', details: error.message });
  }
};

// 3. Puxar o histórico de mensagens de um chat específico, ordenado por data
export const getChatMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    });

    if (!chat) {
      res.status(404).json({ error: 'Conversa não encontrada' });
      return;
    }

    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      res.status(403).json({ error: 'Não autorizado' });
      return;
    }

    res.status(200).json(chat.messages);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar mensagens', details: error.message });
  }
};`;

const CHAT_ROUTES_CODE = `import { Router } from 'express';
import { getOrCreateChat, getUserChats, getChatMessages } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Endpoints de chat protegidos por autenticação
router.post('/', authMiddleware, getOrCreateChat);
router.get('/', authMiddleware, getUserChats);
router.get('/:id/messages', authMiddleware, getChatMessages);

export default router;`;

const FRONT_API_CODE = `// Lê a variável de ambiente configurada na Vercel / localmente
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('electromarket_token') || '';
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', \`Bearer \${token}\`);
  }

  let url = \`\${API_URL}\${endpoint.startsWith('/') ? endpoint : \`/\${endpoint}\`}\`;
  if (options.params) {
    const cleanParamsObj: Record<string, string> = {};
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanParamsObj[key] = val;
      }
    });
    const query = new URLSearchParams(cleanParamsObj).toString();
    if (query) {
      url += \`?\${query}\`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || \`Erro de rede HTTP (Código \${response.status})\`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: async <T>(endpoint: string, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, { ...options, method: 'GET' });
  },
  post: async <T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  put: async <T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  delete: async <T>(endpoint: string, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  }
};`;

const FRONT_AUTH_CONTEXT_CODE = `import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string, avatarUrl?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Efeito ao inicializar o site para recuperar sessão salva
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const savedToken = localStorage.getItem('electromarket_token');
        const savedUser = localStorage.getItem('electromarket_user');

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Erro ao restaurar sessão de autenticação local:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Função para autenticar o usuário e iniciar sessão
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const data = await api.post<{ message: string; user: User; token: string }>('/auth/login', {
        email,
        password,
      });

      setToken(data.token);
      setUser(data.user);

      localStorage.setItem('electromarket_token', data.token);
      localStorage.setItem('electromarket_user', JSON.stringify(data.user));
    } catch (error: any) {
      throw new Error(error.message || 'Falha ao realizar login');
    }
  };

  // Função para registrar um novo usuário
  const register = async (
    name: string,
    email: string,
    password: string,
    phone?: string,
    avatarUrl?: string
  ): Promise<void> => {
    try {
      const data = await api.post<{ message: string; user: User; token: string }>('/auth/register', {
        name,
        email,
        password,
        phone: phone || '',
        avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120px&h=120px&q=80',
      });

      // Login automático após registrar com sucesso
      setToken(data.token);
      setUser(data.user);

      localStorage.setItem('electromarket_token', data.token);
      localStorage.setItem('electromarket_user', JSON.stringify(data.user));
    } catch (error: any) {
      throw new Error(error.message || 'Falha ao registrar conta');
    }
  };

  // Função para deslogar do sistema
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('electromarket_token');
    localStorage.removeItem('electromarket_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser utilizado dentro de um provider <AuthProvider />');
  }
  return context;
};`;

const FRONT_NAVBAR_CODE = `import React, { useState } from 'react';
import { Search, PlusCircle, LogIn, User as UserIcon, LogOut, Flame } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onAnnounceClick?: () => void;
  onLoginClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery = '',
  setSearchQuery,
  onAnnounceClick,
  onLoginClick,
}) => {
  const { user, logout } = useAuth();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    if (setSearchQuery) {
      setSearchQuery(value);
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <div className="bg-blue-600 p-2 rounded-xl text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Flame className="w-5 h-5 fill-white" />
            </div>
            <span className="text-xl font-bold font-sans tracking-tight text-slate-900">
              Electro<span className="text-blue-600">Market</span>
            </span>
          </div>

          <div className="flex-1 max-w-md relative hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar iPhone, Galaxy..."
              value={setSearchQuery ? searchQuery : localSearch}
              onChange={handleSearchChange}
              className="block w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={onAnnounceClick}
                  className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Anunciar</span>
                </button>

                <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                  <div className="flex items-center gap-2 group cursor-pointer">
                    <img
                      src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80px&h=80px&q=80'}
                      alt={user.name}
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                    />
                    <div className="hidden lg:block text-left">
                      <p className="text-xs font-semibold text-slate-800 leading-tight block max-w-[120px] truncate">
                        {user.name}
                      </p>
                      <button
                        type="button"
                        onClick={logout}
                        className="text-[10px] text-slate-400 hover:text-red-500 font-medium transition flex items-center gap-0.5"
                      >
                        Sair
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                className="bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-blue-600" />
                <span>Entrar</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;`;

const FRONT_HOME_PAGE_CODE = `import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Product } from '../types';
import Navbar from '../components/Navbar';
import { Smartphone, Battery, MapPin, Search, Package } from 'lucide-react';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.get<Product[]>('/ads')
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'Todos' ||
      (selectedCategory === 'iPhone' && p.brand.toLowerCase() === 'apple') ||
      (selectedCategory === 'Samsung' && p.brand.toLowerCase() === 'samsung') ||
      (selectedCategory === 'Xiaomi' && p.brand.toLowerCase() === 'xiaomi');

    const matchesSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.model.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Categories Quick Filtering */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8">
          {['Todos', 'iPhone', 'Samsung', 'Xiaomi'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={\`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold border cursor-pointer \${
                selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white text-slate-750'
              }\`}
            >
              <span>{cat}</span>
            </button>
          ))}
        </div>

        {/* Product list grid layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white border rounded-2xl overflow-hidden hover:shadow-md transition">
              <div className="relative aspect-square">
                <img src={product.images?.[0]} className="w-full h-full object-cover" />
                {product.batteryHealth && (
                  <span className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-xs px-2 py-1 rounded">
                    Bateria: {product.batteryHealth}%
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-sm truncate">{product.title}</h3>
                <span className="text-blue-600 font-extrabold block mt-2">
                  R$ {product.price.toLocaleString('pt-BR')}
                </span>
                <span className="text-xs text-slate-400 mt-2 block">{product.location}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}`;

const FRONT_SUPABASE_CODE = `import { createClient } from '@supabase/supabase-js';

// Obter as variáveis de ambiente com prefixo VITE_ para uso no front-end
const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '';

// Se as chaves ainda não estiverem configuradas no painel de segredos/ambiente, 
// criamos uma instância básica ou exportamos null para tratamento elegante na UI.
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project-id.supabase.co');

if (!isConfigured) {
  console.warn(
    '[Supabase] Atenção: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão configuradas. ' +
    'Por favor, configure as variáveis de ambiente para conectar-se ao seu projeto real.'
  );
}

// Instância do cliente Supabase para consultas, autenticação e real-time
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project-id.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export const hasSupabaseConfig = isConfigured;`;

const FRONT_AD_DETAIL_CODE = `'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Product } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import Navbar from '../../../components/Navbar';
import { Smartphone, Battery, MapPin, MessageSquare, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function AdDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  useEffect(() => {
    if (id) {
      api.get<Product>(\`/ads/\${id}\`).then(setProduct).finally(() => setLoading(false));
    }
  }, [id]);

  const handleStartChat = async () => {
    if (!product) return;
    if (!user) {
      router.push('/login');
      return;
    }
    const resp = await api.post<{ id: string }>('/chats', {
      productId: product.id,
      sellerId: product.userId
    });
    router.push(\`/chat?id=\${resp.id}\`);
  };

  if (loading) return <div>Carregando...</div>;
  if (!product) return <div>Anúncio não encontrado.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-square bg-white border rounded-2xl overflow-hidden flex items-center justify-center">
            <img src={product.images?.[activeImageIdx]} className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-6">
            <h1 className="text-xl sm:text-2xl font-extrabold">{product.title}</h1>
            <span className="text-2xl font-black text-blue-600">R$ {product.price.toLocaleString('pt-BR')}</span>
            <button onClick={handleStartChat} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl">
              Conversar com o Vendedor
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}`;

const FRONT_CHAT_CODE = `'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';

export default function ChatPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    api.get('/chats').then(setChats);
  }, []);

  useEffect(() => {
    const socket = io('http://localhost:5000');
    socketRef.current = socket;
    
    if (activeChatId) {
      socket.emit('join_room', activeChatId);
    }

    socket.on('receive_message', (newMsg) => {
      setMessages(prev => [...prev, newMsg]);
    });

    return () => socket.disconnect();
  }, [activeChatId]);

  const handleSend = () => {
    socketRef.current.emit('send_message', {
      chatId: activeChatId,
      senderId: user.id,
      text: inputText
    });
    setInputText('');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        {/* Chats lists sidebar */}
        <div className="w-80 bg-white border-r">
          {chats.map(c => (
            <div key={c.id} onClick={() => setActiveChatId(c.id)}>
              {c.product?.title}
            </div>
          ))}
        </div>
        {/* Chat box */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(m => (
              <div key={m.id} className={m.senderId === user?.id ? 'text-right' : 'text-left'}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="p-4 border-t flex">
            <input value={inputText} onChange={e => setInputText(e.target.value)} />
            <button onClick={handleSend}>Enviar</button>
          </div>
        </div>
      </div>
    </div>
  );
}`;

const FRONT_ANUNCIAR_CODE = `'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';

export default function AnunciarPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [brand, setBrand] = useState('Apple');
  const [model, setModel] = useState('');
  const [storage, setStorage] = useState('128GB');
  const [batteryHealth, setBatteryHealth] = useState('90');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await api.post('/ads', {
      title,
      price: parseFloat(price),
      brand,
      model,
      storage,
      batteryHealth: parseInt(batteryHealth, 10),
      location,
      description,
      images
    });
    router.push('/');
  };

  if (!user) return <div>Faça login para anunciar.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />
      <main className="max-w-xl mx-auto py-12 px-4 bg-white border rounded-2xl p-8 mt-8 shadow-sm">
        <h1 className="text-xl font-bold mb-4">Anunciar Smartphone</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} required />
          <input type="number" placeholder="Preço (R$)" value={price} onChange={e => setPrice(e.target.value)} required />
          <button type="submit" className="bg-blue-600 text-white w-full py-3 rounded-lg">Anunciar</button>
        </form>
      </main>
    </div>
  );
}`;

// Static simulation list
const INITIAL_USERS: User[] = [
  {
    id: "user-buyer-1",
    email: "carol.santos@exemplo.com",
    passwordHash: "$2b$10$xyzBuyerHashSecureString",
    name: "Carol Santos",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    phone: "(11) 98765-4321",
    createdAt: "2026-05-10T12:00:00Z"
  },
  {
    id: "user-seller-2",
    email: "marcos.lima@exemplo.com",
    passwordHash: "$2b$10$abcSellerHashSecureString",
    name: "Marcos Lima",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    phone: "(11) 91234-5678",
    createdAt: "2026-05-01T09:30:00Z"
  },
  {
    id: "user-seller-3",
    email: "ana.oliveira@exemplo.com",
    passwordHash: "$2b$10$defSellerHashSecureString",
    name: "Ana Oliveira",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
    phone: "(21) 99887-7665",
    createdAt: "2026-05-05T14:45:00Z"
  }
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    userId: "user-seller-2",
    title: "iPhone 13 Pro Max 256GB",
    description: "Aparelho em excelente estado de conservação, sem marcas de uso. Acompanha caixa original e cabo original. Único dono, sempre usado com capa e película protetora.",
    price: 3800,
    brand: "Apple",
    model: "iPhone 13 Pro Max",
    batteryHealth: 87,
    storage: "256GB",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuC43OzvIdjYk28qZ-NdeKucLaaTJmVG0FxvCcmIax7R-PLOd0QI_BLz74ds0_zluD2-puXWgboxH94dGqqkq1-3SvuZJikcfjIqIZ9K-f6WxqMQ85ZwQLuvzJjmfxvffVuueWe3zEwqrJfxC5v-IbHpMOTIpZlCKIlAhj9CsgF3KH81JfkABaANSgXhBH8aBTg4LqSAe40ZxuC2VzN8wgvUGrL31FNN-xQ4b9LVLNb0zhrKvVKdL4UMI3HSTLCOmhTiHtAcqR0XL9ht"],
    location: "São Paulo, SP",
    isFeatured: true,
    createdAt: "2026-05-27T10:00:00Z"
  },
  {
    id: "prod-2",
    userId: "user-seller-3",
    title: "Samsung Galaxy S21 Ultra",
    description: "Modelo topo de linha com câmeras fantásticas de até 100x de zoom. Tela perfeita sem riscos, memória de 512GB para armazenar todas as suas fotos e vídeos. Acompanha carregador rápido.",
    price: 2450,
    brand: "Samsung",
    model: "Galaxy S21 Ultra",
    batteryHealth: 92,
    storage: "512GB",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuBp6MX-rQosrE7hr4MRqk76ezQ692T72Fbg6UFynfH3X-Ag96Lf5brEGGzIOeaLHZNXnLQSvthqzUSfMcaL_KDVuvn0O1liA83wfGoJzQmdpdaSjbVa_X9Uj3WOTeaFPO8ecfaB6YgRaHWw_DbNRhxuYf7SPW5zy65EE7aPMtBZFroiQTQq7Vo-LYBR53FP9gxE6ivwc6k-4ZlYEHCx9x5A4ncAUkKcdfi161D-RLdZqYZ2psIj1HMaZRBecdPxoRqHCi1vHe3gmHmJ"],
    location: "Curitiba, PR",
    isFeatured: false,
    createdAt: "2026-05-26T15:30:00Z"
  },
  {
    id: "prod-3",
    userId: "user-seller-2",
    title: "Google Pixel 6 Pro 128GB",
    description: "Experiência Android pura com a melhor inteligência artificial de fotografia do Google Tensor. Aparelho importado, em estado de novo. Bateria impecável.",
    price: 1900,
    brand: "Google",
    model: "Pixel 6 Pro",
    batteryHealth: 89,
    storage: "128GB",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuDylhGhSPFzQ1UaObLEzMyneaTBT7yjrjigPKCvN_NLxj7aVPW8xVLaaInLW-T9SqjIeLJEIWdbt6r9bqJpEaLqbov-m1cPpfC2R6wyPJ2qui-5AU6GbJ9qMMl1kXBMlX0YC3WFFyqDI5xDiAKIHotAAzUp6bbIqKOpDykPMSnAdYv4fojkmwBtJ_Jlgox61e5aEwG5qmBRlZ-F4olg62J6VD_2JWX250vH08kZBU6sIim6sAru5MTGvwpNNu0KnM7P2N5NSAGUZL2y"],
    location: "Rio de Janeiro, RJ",
    isFeatured: false,
    createdAt: "2026-05-27T13:00:00Z"
  },
  {
    id: "prod-4",
    userId: "user-seller-3",
    title: "Xiaomi Mi 11 Ultra 256GB",
    description: "Modelo premium com tela traseira secundária, sensor fotográfico gigantesco, super fluidez com 12GB de memória RAM. Um verdadeiro canhão de desempenho.",
    price: 2200,
    brand: "Xiaomi",
    model: "Mi 11 Ultra",
    batteryHealth: 90,
    storage: "256GB",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuAf5SGQePGGN1kaCvpDQ44RQltdOo45_Iu3dTGLoSnanUNXVSwOwaYuEPgeTYI4Cl0dcYtk-N4Z405XgOA9iJIUKnudTzK7UkVVCeBYqFOfGwYluCQQDpv0SnfquergTQGWz6gac7tNJJ4q2Ic_pTohvGGMomyaA3a7H3FIAgf6rAYD3RUH34MusOAu2y_sUmc1F-I5E4PQ5A_JKB8YX6AkH-GYDc8-wHCMmzdmQfAGjjzXzgK4SAiDbWRIfCuMnyv5Msgl0z6Xo8QB"],
    location: "Belo Horizonte, MG",
    isFeatured: true,
    createdAt: "2026-05-27T14:45:00Z"
  }
];

const INITIAL_CHATS: Chat[] = [
  {
    id: "chat-1",
    buyerId: "user-buyer-1",
    sellerId: "user-seller-2",
    productId: "prod-1",
    createdAt: "2026-05-27T11:00:00Z"
  }
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: "msg-1",
    chatId: "chat-1",
    senderId: "user-buyer-1",
    text: "Olá Marcos! O iPhone ainda está disponível? Qual a saúde real da bateria?",
    createdAt: "2026-05-27T11:02:00Z"
  },
  {
    id: "msg-2",
    chatId: "chat-1",
    senderId: "user-seller-2",
    text: "Olá Carol, tudo bom? Está disponível sim! A bateria está com 87% de capacidade máxima. Durando o dia todo tranquilamente para uso geral.",
    createdAt: "2026-05-27T11:05:00Z"
  },
  {
    id: "msg-3",
    chatId: "chat-1",
    senderId: "user-buyer-1",
    text: "Excelente. Você aceitaria encontro presencial para entrega em shopping de São Paulo por segurança?",
    createdAt: "2026-05-27T11:10:00Z"
  },
  {
    id: "msg-4",
    chatId: "chat-1",
    senderId: "user-seller-2",
    text: "Sim, com certeza! Costumo entregar no Shopping Center Norte aos finais de semana e no Shopping Paulista durante a semana. O que fica melhor pra você?",
    createdAt: "2026-05-27T11:14:00Z"
  }
];

export default function App() {
  const [isPending, startTransition] = useTransition();
  
  // Real dynamic states simulating a mini PostgreSQL database driven by standard hooks
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingAds, setLoadingAds] = useState<boolean>(true);
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  // Supabase Google Auth and local login integration
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Sincroniza informações do Google Auth com o banco principal via Prisma no Backend
  const syncUserToBackend = async (userObj: User) => {
    try {
      const response = await api.post<{ message: string; user: User; token: string }>('/users/sync', {
        id: userObj.id,
        email: userObj.email,
        name: userObj.name,
        avatarUrl: userObj.avatarUrl,
        phone: userObj.phone
      });
      if (response && response.token) {
        localStorage.setItem('electromarket_token', response.token);
      }
      console.log('[Sync] Usuário sincronizado com o backend (PostgreSQL via Prisma) com sucesso!');
    } catch (err) {
      console.error('[Sync] Falha ao sincronizar perfil do Google com o backend:', err);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userObj: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário Google',
            avatarUrl: session.user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120px&h=120px&q=80',
            phone: session.user.phone || '(11) 99999-9999',
            createdAt: session.user.created_at || new Date().toISOString()
          };
          setCurrentUser(userObj);
          setUsers(prev => {
            if (!prev.find(u => u.id === userObj.id)) {
              return [...prev, userObj];
            }
            return prev;
          });
          // Sincroniza com PostgreSQL de forma transparente
          await syncUserToBackend(userObj);
        }
      } catch (err) {
        console.error('Erro ao verificar sessão do Supabase:', err);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userObj: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário Google',
          avatarUrl: session.user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120px&h=120px&q=80',
          phone: session.user.phone || '(11) 99999-9999',
          createdAt: session.user.created_at || new Date().toISOString()
        };
        setCurrentUser(userObj);
        setUsers(prev => {
          if (!prev.find(u => u.id === userObj.id)) {
            return [...prev, userObj];
          }
          return prev;
        });
        // Sincroniza com PostgreSQL de forma transparente
        await syncUserToBackend(userObj);
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro no login social do Google:', err.message || err);
      alert('Erro ao iniciar login com o Google. Certifique-se de configurar VITE_SUPABASE_URL.');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
    setCurrentUser(null);
  };

  // Interface states
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [newsletterEmail, setNewsletterEmail] = useState<string>("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState<boolean>(false);

  // Carrega anúncios reais do backend da Render (banco Supabase) ao montar ou mudar filtro de categoria
  useEffect(() => {
    const fetchAds = async () => {
      setLoadingAds(true);
      try {
        let url = '/ads';
        if (selectedCategory && selectedCategory !== 'Todos') {
          url += `?filter=${encodeURIComponent(selectedCategory)}`;
        }
        const data = await api.get<Product[]>(url);
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          // Fallback se não for array
          setProducts(INITIAL_PRODUCTS);
        }
      } catch (err: any) {
        console.warn('Erro ao buscar anúncios do backend real:', err);
        // Fallback gracioso mantendo os hardcoded se a API falhar no sandbox
        setProducts(INITIAL_PRODUCTS);
      } finally {
        setLoadingAds(false);
      }
    };
    fetchAds();
  }, [selectedCategory]);
  
  // Chat modal state
  const [showChatModal, setShowChatModal] = useState<boolean>(false);

  // Simple state-based router for single-page dynamic layouts
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [hasNewMessageAlert, setHasNewMessageAlert] = useState<boolean>(false);

  useEffect(() => {
    if (currentPath.startsWith("/chat")) {
      setHasNewMessageAlert(false);
    }
  }, [currentPath]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  const socketRef = useRef<any>(null);

  // Estabelece a conexão real-time com o backend via Socket.io
  useEffect(() => {
    const socketServer = (import.meta as any).env?.VITE_API_URL
      ? (import.meta as any).env.VITE_API_URL.replace(/\/api\/?$/, '')
      : 'http://localhost:5000';

    const socket = io(socketServer, {
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.io] Conector habilitado com sucesso no backend:', socketServer);
    });

    socket.on('receive_message', (newMsg: any) => {
      console.log('[Socket.io] Nova mensagem real-time recebida do Postgres:', newMsg);
      const chatRoomId = newMsg.chatRoomId || newMsg.chatId;
      setMessages(prev => {
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, {
          id: newMsg.id,
          chatId: chatRoomId,
          chatRoomId: chatRoomId,
          senderId: newMsg.senderId,
          text: newMsg.text,
          createdAt: newMsg.createdAt
        }];
      });
      setHasNewMessageAlert(true);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Evento para entrar em sala após alteração do chat ativo
  useEffect(() => {
    if (activeChatId && socketRef.current) {
      socketRef.current.emit('join_room', activeChatId);
      console.log(`[Socket.io] Solicitando entrada no canal privado: ${activeChatId}`);
    }
  }, [activeChatId]);

  // Carrega salas de chat reais (ChatRoom) do banco de dados na inicialização/mudança do usuário
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const activeUserId = currentUser ? currentUser.id : "user-buyer-1";
        // Consome a rota real unificada do banco: GET /api/chats/rooms/:userId
        const fetchedChats = await api.get<Chat[]>(`/chats/rooms/${activeUserId}`);
        if (Array.isArray(fetchedChats)) {
          const mappedChats = fetchedChats.map(c => ({
            ...c,
            chatRoomId: c.chatRoomId || c.id
          }));
          setChats(mappedChats);
        }
      } catch (err) {
        console.warn('Erro ao buscar canais de chat do backend real:', err);
      }
    };

    fetchChats();
    // Sincronização secundária via polling para máxima robustez em iframes de desenvolvimento
    const interval = setInterval(fetchChats, 4000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Carrega o histórico de mensagens reais salvas no banco de dados para a conversa selecionada
  useEffect(() => {
    if (!activeChatId) return;

    const fetchMessages = async () => {
      try {
        // Consome a rota real unificada do banco: GET /api/chats/rooms/:roomId/messages
        const fetchedMsgs = await api.get<any>(`/chats/rooms/${activeChatId}/messages`);
        
        let messagesArray: any[] = [];
        if (fetchedMsgs) {
          if (Array.isArray(fetchedMsgs)) {
            messagesArray = fetchedMsgs;
          } else if (typeof fetchedMsgs === 'object') {
            if (Array.isArray(fetchedMsgs.messages)) {
              messagesArray = fetchedMsgs.messages;
            } else if (Array.isArray(fetchedMsgs.data)) {
              messagesArray = fetchedMsgs.data;
            } else if (fetchedMsgs.data && Array.isArray(fetchedMsgs.data.messages)) {
              messagesArray = fetchedMsgs.data.messages;
            }
          }
        }

        const mappedMsgs = messagesArray.map(m => ({
          ...m,
          chatId: m?.chatRoomId || m?.chatId,
          chatRoomId: m?.chatRoomId || m?.chatId
        }));

        setMessages(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          // Mantém na tela no momento do polling as mensagens que falharam em salvar no banco ou são locais/offline provisórias
          const unsavedMsgsOfActiveChat = safePrev.filter(m => 
            m && (m.chatId || (m as any).chatRoomId) === activeChatId && 
            ((m as any).isError || (m as any).isUnsaved || (m.id && (m.id.startsWith('msg-temp') || m.id.startsWith('msg-offline') || m.id.startsWith('msg-saved-local'))))
          );
          const others = safePrev.filter(m => m && (m.chatId || (m as any).chatRoomId) !== activeChatId);
          return [...others, ...mappedMsgs, ...unsavedMsgsOfActiveChat];
        });
      } catch (err) {
        console.warn('Falha nas mensagens do banco:', err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeChatId, currentUser]);

  // Automatic Chat routing & synchronization effect for /chat?productId=XXX
  useEffect(() => {
    if (currentPath.startsWith("/chat")) {
      const urlParams = new URLSearchParams(window.location.search);
      const prodId = urlParams.get("productId");
      if (prodId) {
        const allProds = products.length > 0 ? products : INITIAL_PRODUCTS;
        const product = allProds.find(p => p.id === prodId);
        if (product) {
          const activeUser = currentUser || INITIAL_USERS[0];
          
          const openChatViaGateway = async () => {
            try {
              // Obtém ou cria a sala real persistente no PostgreSQL via rota POST /chats/rooms
              const realChat = await api.post<any>('/chats/rooms', {
                productId: product.id,
                buyerId: activeUser.id
              });

              if (realChat && realChat.id) {
                setActiveChatId(realChat.id);
                setChats(prev => {
                  if (prev.find(c => c.id === realChat.id)) return prev;
                  return [realChat, ...prev];
                });

                // Dispara o texto de interesse inicial reais se for sala nova vazia
                const messagesList = await api.get<any[]>(`/chats/rooms/${realChat.id}/messages`);
                if (messagesList.length === 0) {
                  const initialText = `Olá! Tenho interesse no seu "${product.title}" anunciado por R$ ${product.price.toLocaleString('pt-BR')}.`;
                  handleSendDynamicMessage(realChat.id, initialText);
                }
              }
            } catch (err) {
              console.error('[Gateway Chat] Erro na criação de sala via POST /chats/rooms, utilizando memória local:', err);
              const newChatId = `chat-${Date.now()}`;
              const newChatRecord: Chat = {
                id: newChatId,
                buyerId: activeUser.id,
                sellerId: product.userId,
                productId: product.id,
                createdAt: new Date().toISOString()
              };
              setChats(prev => [...prev, newChatRecord]);
              setActiveChatId(newChatId);
            }
          };

          openChatViaGateway();
        }
        // Replace search parameters gracefully
        window.history.replaceState({}, "", "/chat");
      }
    }
  }, [currentPath, products, currentUser]);

  const handleSendDynamicMessage = async (chatRoomIdToUse: string, text: string) => {
    const senderId = currentUser ? currentUser.id : "user-buyer-1";
    
    // Cria um objeto de mensagem otimista e atualiza a tela IMEDIATAMENTE para máxima agilidade
    const tempId = `msg-temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      chatId: chatRoomIdToUse,
      chatRoomId: chatRoomIdToUse,
      senderId: senderId,
      text: text,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // Salva no banco de dados através da rota real: POST /api/chats/messages
      const savedMsg = await api.post<any>('/chats/messages', {
        chatRoomId: chatRoomIdToUse,
        roomId: chatRoomIdToUse,
        chatId: chatRoomIdToUse,
        senderId: senderId,
        text: text
      });

      console.log('[API] Mensagem enviada e salva com sucesso no PostgreSQL via HTTP POST:', savedMsg);

      const mappedMsg: Message = {
        id: savedMsg.id,
        chatId: savedMsg.chatRoomId || savedMsg.chatId || chatRoomIdToUse,
        chatRoomId: savedMsg.chatRoomId || savedMsg.chatId || chatRoomIdToUse,
        senderId: savedMsg.senderId,
        text: savedMsg.text,
        createdAt: savedMsg.createdAt || new Date().toISOString()
      };

      // Substitui a mensagem otimista temporária na tela pelo registro definitivo persistido no banco
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempId);
        if (filtered.find(m => m.id === mappedMsg.id)) return filtered;
        return [...filtered, mappedMsg];
      });

      // Em seguida, transmite a mensagem via Socket.io em segundo plano
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('send_message', mappedMsg);
      }
    } catch (err) {
      console.warn('[API] Erro ao salvar mensagem via HTTP POST, mantendo offline na tela:', err);
      
      const permanentLocalId = `msg-saved-local-${Date.now()}`;
      
      // Converte a mensagem otimista temporária em uma mensagem offline permanente (isError + isUnsaved) para que o polling não a apague
      setMessages(prev => 
        prev.map(m => m.id === tempId ? { ...m, id: permanentLocalId, isError: true, isUnsaved: true } : m)
      );

      // Exibe de forma visível e explícita o log e o alerta ao usuário
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[CHAT API ERROR] Falha ao persistir mensagem no banco de dados principal: ${errorMsg}`);
      alert(`Servidor Indisponível (404/Erro): Não foi possível gravar a mensagem no banco de dados. A mensagem foi mantida na tela como offline.`);

      const socketPayload = {
        id: permanentLocalId,
        chatId: chatRoomIdToUse,
        chatRoomId: chatRoomIdToUse,
        senderId: senderId,
        text: text,
        createdAt: new Date().toISOString(),
        isError: true,
        isUnsaved: true
      };

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('send_message', socketPayload);
      }
    }
  };

  const matchAnuncio = currentPath.match(/^\/anuncio\/([a-zA-Z0-9-]+)$/);
  const adIdFromUrl = matchAnuncio ? matchAnuncio[1] : null;
  const adProduct = adIdFromUrl 
    ? (products.find(p => p.id === adIdFromUrl) || INITIAL_PRODUCTS.find(p => p.id === adIdFromUrl)) 
    : null;

  // Active details / modal states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAnnounceModal, setShowAnnounceModal] = useState<boolean>(false);
  const [typedMessage, setTypedMessage] = useState<string>("");

  // New Ad form state
  const [newAd, setNewAd] = useState({
    title: "",
    description: "",
    price: "",
    brand: "Apple",
    model: "",
    batteryHealth: "90",
    storage: "128GB",
    location: "São Paulo, SP",
    isFeatured: false,
    imagePreset: "https://lh3.googleusercontent.com/aida-public/AB6AXuC43OzvIdjYk28qZ-NdeKucLaaTJmVG0FxvCcmIax7R-PLOd0QI_BLz74ds0_zluD2-puXWgboxH94dGqqkq1-3SvuZJikcfjIqIZ9K-f6WxqMQ85ZwQLuvzJjmfxvffVuueWe3zEwqrJfxC5v-IbHpMOTIpZlCKIlAhj9CsgF3KH81JfkABaANSgXhBH8aBTg4LqSAe40ZxuC2VzN8wgvUGrL31FNN-xQ4b9LVLNb0zhrKvVKdL4UMI3HSTLCOmhTiHtAcqR0XL9ht"
  });
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);

  // Edit Ad form state
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [editAdData, setEditAdData] = useState({
    title: "",
    description: "",
    price: "",
    brand: "Apple",
    model: "",
    batteryHealth: "90",
    storage: "128GB",
    location: "São Paulo, SP",
    isFeatured: false,
    imagePreset: "https://lh3.googleusercontent.com/aida-public/AB6AXuC43OzvIdjYk28qZ-NdeKucLaaTJmVG0FxvCcmIax7R-PLOd0QI_BLz74ds0_zluD2-puXWgboxH94dGqqkq1-3SvuZJikcfjIqIZ9K-f6WxqMQ85ZwQLuvzJjmfxvffVuueWe3zEwqrJfxC5v-IbHpMOTIpZlCKIlAhj9CsgF3KH81JfkABaANSgXhBH8aBTg4LqSAe40ZxuC2VzN8wgvUGrL31FNN-xQ4b9LVLNb0zhrKvVKdL4UMI3HSTLCOmhTiHtAcqR0XL9ht"
  });

  const handleDeleteAd = async (adId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Evita que clique no botão abra os detalhes do produto

    const userConfirmed = window.confirm('Tem certeza que deseja deletar este anúncio?');
    if (!userConfirmed) return;

    try {
      const token = localStorage.getItem('electromarket_token') || '';
      
      // Conecta ao endpoint real do Render informado pelo usuário
      const response = await fetch(`https://electromarket-s30g.onrender.com/api/ads/${adId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Servidor respondeu com status ${response.status}`);
      }

      // Sucesso na remoção da base
      setProducts((prevProducts) => prevProducts.filter(p => p.id !== adId));
      if (selectedProduct && selectedProduct.id === adId) {
        setSelectedProduct(null);
      }
      alert('Anúncio excluído com sucesso!');
    } catch (err: any) {
      console.warn('Conexão direta com a API externa falhou, tentando fallback local...', err);
      
      // Fallback local via api.delete (nosso helper padrão que gerencia url de ambiente)
      try {
        await api.delete(`/ads/${adId}`);
        setProducts((prevProducts) => prevProducts.filter(p => p.id !== adId));
        if (selectedProduct && selectedProduct.id === adId) {
          setSelectedProduct(null);
        }
        alert('Anúncio excluído com sucesso (via API local)!');
      } catch (localErr: any) {
        console.error('Falha ao excluir o anúncio no servidor:', localErr);
        alert(`Ocorreu um erro ao excluir o anúncio: ${localErr.message || localErr}`);
      }
    }
  };

  const handleEditAdClick = (product: Product, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingAdId(product.id);
    setEditAdData({
      title: product.title,
      description: product.description || "",
      price: product.price.toString(),
      brand: product.brand || "Apple",
      model: product.model || "",
      batteryHealth: product.batteryHealth ? product.batteryHealth.toString() : "",
      storage: product.storage || "128GB",
      location: product.location || "São Paulo, SP",
      isFeatured: !!product.isFeatured,
      imagePreset: product.images?.[0] || "https://lh3.googleusercontent.com/aida-public/AB6AXuC43OzvIdjYk28qZ-NdeKucLaaTJmVG0FxvCcmIax7R-PLOd0QI_BLz74ds0_zluD2-puXWgboxH94dGqqkq1-3SvuZJikcfjIqIZ9K-f6WxqMQ85ZwQLuvzJjmfxvffVuueWe3zEwqrJfxC5v-IbHpMOTIpZlCKIlAhj9CsgF3KH81JfkABaANSgXhBH8aBTg4LqSAe40ZxuC2VzN8wgvUGrL31FNN-xQ4b9LVLNb0zhrKvVKdL4UMI3HSTLCOmhTiHtAcqR0XL9ht"
    });
    setShowEditModal(true);
  };

  const handleSaveEditedAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdId) return;

    if (!editAdData.title || !editAdData.price || !editAdData.model) {
      alert("Por favor preencha os campos obrigatórios (Título, Preço e Modelo).");
      return;
    }

    const priceNum = parseFloat(editAdData.price);
    if (isNaN(priceNum)) {
      alert("Insira um preço válido.");
      return;
    }

    const token = localStorage.getItem('electromarket_token') || '';

    const payload = {
      title: editAdData.title,
      description: editAdData.description || "Nenhuma descrição fornecida.",
      price: priceNum,
      brand: editAdData.brand,
      model: editAdData.model,
      batteryHealth: editAdData.batteryHealth ? parseInt(editAdData.batteryHealth) : null,
      storage: editAdData.storage,
      location: editAdData.location,
      isFeatured: editAdData.isFeatured,
      images: [editAdData.imagePreset]
    };

    try {
      const response = await fetch(`https://electromarket-s30g.onrender.com/api/ads/${editingAdId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Erro no servidor HTTP ${response.status}`);
      }

      // Se a API responder com sucesso
      setProducts(prevProducts => prevProducts.map(p => {
        if (p.id === editingAdId) {
          return {
            ...p,
            title: editAdData.title,
            description: editAdData.description || "Nenhuma descrição fornecida.",
            price: priceNum,
            brand: editAdData.brand,
            model: editAdData.model,
            batteryHealth: editAdData.batteryHealth ? parseInt(editAdData.batteryHealth) : undefined,
            storage: editAdData.storage,
            location: editAdData.location,
            isFeatured: editAdData.isFeatured,
            images: [editAdData.imagePreset]
          };
        }
        return p;
      }));

      // Se o produto editado for o atualmente selecionado nos detalhes, atualiza ele também
      if (selectedProduct && selectedProduct.id === editingAdId) {
        setSelectedProduct({
          ...selectedProduct,
          title: editAdData.title,
          description: editAdData.description || "Nenhuma descrição fornecida.",
          price: priceNum,
          brand: editAdData.brand,
          model: editAdData.model,
          batteryHealth: editAdData.batteryHealth ? parseInt(editAdData.batteryHealth) : undefined,
          storage: editAdData.storage,
          location: editAdData.location,
          isFeatured: editAdData.isFeatured,
          images: [editAdData.imagePreset]
        });
      }

      setShowEditModal(false);
      alert('Anúncio atualizado com sucesso!');
    } catch (err: any) {
      console.warn('Conexão direta com a API externa falhou, tentando fallback local...', err);
      try {
        await api.put(`/ads/${editingAdId}`, payload);
        
        setProducts(prevProducts => prevProducts.map(p => {
          if (p.id === editingAdId) {
            return {
              ...p,
              title: editAdData.title,
              description: editAdData.description || "Nenhuma descrição fornecida.",
              price: priceNum,
              brand: editAdData.brand,
              model: editAdData.model,
              batteryHealth: editAdData.batteryHealth ? parseInt(editAdData.batteryHealth) : undefined,
              storage: editAdData.storage,
              location: editAdData.location,
              isFeatured: editAdData.isFeatured,
              images: [editAdData.imagePreset]
            };
          }
          return p;
        }));

        if (selectedProduct && selectedProduct.id === editingAdId) {
          setSelectedProduct({
            ...selectedProduct,
            title: editAdData.title,
            description: editAdData.description || "Nenhuma descrição fornecida.",
            price: priceNum,
            brand: editAdData.brand,
            model: editAdData.model,
            batteryHealth: editAdData.batteryHealth ? parseInt(editAdData.batteryHealth) : undefined,
            storage: editAdData.storage,
            location: editAdData.location,
            isFeatured: editAdData.isFeatured,
            images: [editAdData.imagePreset]
          });
        }

        setShowEditModal(false);
        alert('Anúncio atualizado com sucesso (via API local)!');
      } catch (localErr: any) {
        console.error('Falha ao atualizar o anúncio no servidor:', localErr);
        alert(`Ocorreu um erro ao atualizar o anúncio: ${localErr.message || localErr}`);
      }
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAd.title || !newAd.price || !newAd.model) {
      alert("Por favor preencha os campos obrigatórios (Título, Preço e Modelo).");
      return;
    }

    const priceNum = parseFloat(newAd.price);
    if (isNaN(priceNum)) {
      alert("Insira um preço válido.");
      return;
    }

    // Fluxo de autenticação automática em plano de fundo no Supabase
    let token = localStorage.getItem('electromarket_token');
    if (!token) {
      try {
        const authData = await api.post<{ token: string; user: any }>('/auth/login', {
          email: 'carol.santos@exemplo.com',
          password: 'password123'
        });
        token = authData.token;
        localStorage.setItem('electromarket_token', authData.token);
        localStorage.setItem('electromarket_user', JSON.stringify(authData.user));
      } catch (loginErr) {
        // Se falhar o login, tenta registrar a Carol Santos
        try {
          const authData = await api.post<{ token: string; user: any }>('/auth/register', {
            name: 'Carol Santos',
            email: 'carol.santos@exemplo.com',
            password: 'password123',
            phone: '(11) 98765-4321',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
          });
          token = authData.token;
          localStorage.setItem('electromarket_token', authData.token);
          localStorage.setItem('electromarket_user', JSON.stringify(authData.user));
        } catch (regErr) {
          console.error('Erro na autenticação automática para criação:', regErr);
        }
      }
    }

    // Enviar anúncio real para o backend na Render
    let loggedInUserId = currentUser ? currentUser.id : "user-buyer-1";
    try {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (supabaseUser) {
        loggedInUserId = supabaseUser.id;
        console.log('[CreateAd] Capturado userId dinâmico da sessão ativa do Supabase:', loggedInUserId);
      }
    } catch (err) {
      console.warn('[CreateAd] Erro ao obter userId dinâmico do Supabase, usando fallback:', err);
    }

    let realProduct: Product | null = null;
    try {
      let response;
      if (selectedImageFiles.length > 0) {
        const formData = new FormData();
        formData.append('title', newAd.title);
        formData.append('description', newAd.description || "Nenhuma descrição fornecida.");
        formData.append('price', priceNum.toString());
        formData.append('brand', newAd.brand);
        formData.append('model', newAd.model);
        if (newAd.batteryHealth) formData.append('batteryHealth', newAd.batteryHealth);
        if (newAd.storage) formData.append('storage', newAd.storage);
        formData.append('location', newAd.location);
        formData.append('isFeatured', newAd.isFeatured ? 'true' : 'false');
        formData.append('userId', loggedInUserId);
        
        // Append all selected image files to field "images" (matches upload.array('images', 5) backend middleware)
        selectedImageFiles.forEach((file) => {
          formData.append('images', file);
        });

        // Debug form state elements securely without exposing files binary
        const formObj: Record<string, any> = {};
        formData.forEach((value, key) => {
          if (value instanceof File) {
            formObj[key] = `File: ${value.name} (${value.size} bytes)`;
          } else {
            formObj[key] = value;
          }
        });
        console.log("Payload enviado do Frontend (FormData):", formObj);

        response = await api.post<{ message: string; ad: Product }>('/ads', formData);
      } else {
        const payloadJson = {
          title: newAd.title,
          description: newAd.description || "Nenhuma descrição fornecida.",
          price: priceNum,
          brand: newAd.brand,
          model: newAd.model,
          batteryHealth: newAd.batteryHealth ? parseInt(newAd.batteryHealth) : null,
          storage: newAd.storage,
          images: [newAd.imagePreset],
          location: newAd.location,
          isFeatured: newAd.isFeatured,
          userId: loggedInUserId
        };
        console.log("Payload enviado do Frontend:", payloadJson);

        response = await api.post<{ message: string; ad: Product }>('/ads', payloadJson);
      }
      
      if (response && response.ad) {
        realProduct = response.ad;
      }
    } catch (apiErr: any) {
      console.error("Erro completo recebido no front:", apiErr.response?.data || apiErr);
      console.error("Erro ao publicar na API real. Detalhes completos do erro:", apiErr);
      alert(`Aviso: Conexão direta com a API falhou (Erro: ${apiErr?.message || apiErr}). O anúncio foi salvo localmente temporariamente.`);
    }

    const localImageUrls = selectedImageFiles.length > 0
      ? selectedImageFiles.map(file => URL.createObjectURL(file))
      : [newAd.imagePreset];

    const generatedId = realProduct ? realProduct.id : `prod-custom-${Date.now()}`;
    const newProductRecord: Product = realProduct || {
      id: generatedId,
      userId: loggedInUserId, // Dynamic logged user model
      title: newAd.title,
      description: newAd.description || "Nenhuma descrição fornecida.",
      price: priceNum,
      brand: newAd.brand,
      model: newAd.model,
      batteryHealth: newAd.batteryHealth ? parseInt(newAd.batteryHealth) : undefined,
      storage: newAd.storage,
      images: localImageUrls,
      location: newAd.location,
      isFeatured: newAd.isFeatured,
      createdAt: new Date().toISOString()
    };

    setProducts(prevProducts => [newProductRecord, ...prevProducts]);
    setShowAnnounceModal(false);
    
    // Auto reset form and state
    setSelectedImageFiles([]);
    setNewAd({
      title: "",
      description: "",
      price: "",
      brand: "Apple",
      model: "",
      batteryHealth: "90",
      storage: "128GB",
      location: "São Paulo, SP",
      isFeatured: false,
      imagePreset: "https://lh3.googleusercontent.com/aida-public/AB6AXuC43OzvIdjYk28qZ-NdeKucLaaTJmVG0FxvCcmIax7R-PLOd0QI_BLz74ds0_zluD2-puXWgboxH94dGqqkq1-3SvuZJikcfjIqIZ9K-f6WxqMQ85ZwQLuvzJjmfxvffVuueWe3zEwqrJfxC5v-IbHpMOTIpZlCKIlAhj9CsgF3KH81JfkABaANSgXhBH8aBTg4LqSAe40ZxuC2VzN8wgvUGrL31FNN-xQ4b9LVLNb0zhrKvVKdL4UMI3HSTLCOmhTiHtAcqR0XL9ht"
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeChatId) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      chatId: activeChatId,
      senderId: "user-buyer-1", // Buyer is typing
      text: typedMessage,
      createdAt: new Date().toISOString()
    };

    setMessages([...messages, newMsg]);
    setTypedMessage("");

    // Simulate auto seller reply in 1.5 seconds for extra premium interactive experience
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat) {
      const seller = users.find(u => u.id === activeChat.sellerId);
      setTimeout(() => {
        const replyMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          chatId: activeChatId,
          senderId: activeChat.sellerId,
          text: `[Mensagem Automática Simulação] Olá! Recebi sua mensagem: "${newMsg.text.substring(0, 20)}...". Em breve entrarei em contato pelo telefone ${seller?.phone || '(11) 99999-9999'}. Obrigado!`,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, replyMsg]);
        setHasNewMessageAlert(true);
      }, 1500);
    }
  };

  // Open chat for a specific product
  const startChatForProduct = (product: Product) => {
    navigate(`/chat?productId=${product.id}`);
  };

  const filteredProducts = products.filter(p => {
    const brandLower = p.brand?.toLowerCase() || "";
    const matchesCategory = selectedCategory === "Todos" || 
      (selectedCategory === "iPhone" && (brandLower === "apple" || brandLower === "iphone")) || 
      (selectedCategory === "Samsung" && brandLower === "samsung") ||
      (selectedCategory === "Xiaomi" && brandLower === "xiaomi") ||
      (selectedCategory === "Motorola" && brandLower === "motorola") ||
      (selectedCategory === "Outros" && !["apple", "iphone", "samsung", "xiaomi", "motorola"].includes(brandLower)) ||
      (selectedCategory === "Até R$ 1.500" && p.price <= 1500) ||
      (selectedCategory === "Bateria 90%+" && p.batteryHealth && p.batteryHealth >= 90) ||
      (selectedCategory === "Garantia Válida" && (!!p.hasWarranty || p.title?.toLowerCase().includes("garantia") || p.description?.toLowerCase().includes("garantia")));

    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 transition-colors duration-300">
      


      {/* Main TopNavBar */}
      <nav id="top-nav" className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setSelectedCategory("Todos"); navigate("/"); }}>
            <div className="bg-[#2563eb] p-1.5 rounded-lg text-white">
              <Flame className="w-6 h-6 fill-white" />
            </div>
            <span className="text-xl font-bold font-title tracking-tight text-[#004ac6]">ElectroMarket</span>
          </div>

          <div className="hidden md:flex flex-1 max-w-lg relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar iPhone, Galaxy, Pixels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 hover:bg-slate-200/70 focus:bg-white focus:ring-2 focus:ring-[#2563eb] rounded-lg border border-transparent focus:border-slate-300 transition-all text-sm outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAnnounceModal(true)}
              className="bg-[#2563eb] text-white hover:bg-blue-700 px-5 py-2.5 rounded-lg font-semibold text-sm transition flex items-center gap-1.5 active:scale-95 duration-100 shadow-md"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              <span>Anunciar</span>
            </button>

            <button 
              onClick={() => { navigate("/chat"); }}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-semibold text-sm transition flex items-center gap-1.5 cursor-pointer"
              id="btn-header-chats-link"
            >
              <MessageSquare className="w-4.5 h-4.5 text-[#2563eb]" />
              <span className="hidden lg:inline">Chats de Negociação</span>
              {chats.length > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  {hasNewMessageAlert && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hasNewMessageAlert ? "bg-red-500 animate-pulse bg-red-500" : "bg-red-400"}`}></span>
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 ml-1">
              <div 
                className="p-2 hover:bg-slate-100 rounded-full cursor-pointer relative"
                title="Carrinho de Compras / Chats"
                onClick={() => { navigate("/chat"); }}
              >
                <ShoppingCart className="w-5 h-5 text-slate-600" />
                <span className="absolute top-1 right-1 bg-[#2563eb] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {products.length}
                </span>
              </div>

              {currentUser ? (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="flex items-center gap-2">
                    <img
                      src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80px&h=80px&q=80'}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
                      onClick={() => navigate("/profile")}
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all"
                      title="Ver seu perfil"
                    />
                    <div className="hidden lg:block text-left max-w-[125px]">
                      <p 
                        onClick={() => navigate("/profile")}
                        className="text-xs font-semibold text-slate-800 leading-tight truncate cursor-pointer hover:text-blue-600 transition"
                        title="Ver seu perfil"
                      >
                        {currentUser.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => navigate("/profile")}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold transition cursor-pointer"
                        >
                          Meu Perfil
                        </button>
                        <span className="text-[10px] text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="text-[10px] text-slate-400 hover:text-red-500 font-medium transition cursor-pointer flex items-center gap-0.5"
                        >
                          Sair
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <UserIcon className="w-4 h-4 text-blue-600" />
                  <span>Entrar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-grow w-full py-6">
        <AnimatePresence mode="wait">
          {currentPath.startsWith("/anuncio/") ? (
            <motion.div
              key={`anuncio-page-${adIdFromUrl || "unknown"}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full"
            >
              {adProduct ? (
                <ProductDetails 
                  product={adProduct} 
                  onNegotiate={() => startChatForProduct(adProduct)} 
                  onBack={() => navigate("/")} 
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm my-8">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
                  <h3 className="text-lg font-bold text-slate-800">Buscando detalhes do anúncio...</h3>
                  <p className="text-slate-500 max-w-md mx-auto text-sm mt-1">
                    Aguarde um instante enquanto localizamos este smartphone no nosso banco de dados.
                  </p>
                  <button 
                    onClick={() => navigate("/")}
                    className="mt-6 bg-[#2563eb] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    Voltar para o Catálogo
                  </button>
                </div>
              )}
            </motion.div>
          ) : currentPath.startsWith("/chat") ? (
            <motion.div
              key="chat-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col"
            >
              <ChatWindow
                currentUser={currentUser || INITIAL_USERS[0]}
                chats={chats}
                messages={messages}
                products={products.length > 0 ? products : INITIAL_PRODUCTS}
                users={users}
                onSendMessage={handleSendDynamicMessage}
                selectedChatIdFromRoute={activeChatId}
              />
            </motion.div>
          ) : currentPath.startsWith("/profile") ? (
            <motion.div
              key="profile-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full"
            >
              <ProfilePage 
                onBack={() => navigate("/")} 
                onNavigate={(path) => navigate(path)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="catalog-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full"
            >
              {/* Responsive Search for mobile view */}
              <div className="mb-6 md:hidden relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar iPhone, Galaxy, Pixels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm outline-none shadow-sm focus:ring-2 focus:ring-[#2563eb]"
                />
              </div>

              {/* Categories Chips */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-4 mb-8 -mx-4 px-4 scrollbar-thin scrollbar-thumb-slate-300">
                {[
                  { id: "Todos", label: "Todos", icon: null },
                  { id: "iPhone", label: "iPhone", icon: <Smartphone className="w-4 h-4" /> },
                  { id: "Samsung", label: "Samsung", icon: <Smartphone className="w-4 h-4" /> },
                  { id: "Xiaomi", label: "Xiaomi", icon: null },
                  { id: "Motorola", label: "Motorola", icon: <Smartphone className="w-4 h-4" /> },
                  { id: "Outros", label: "Outros", icon: null },
                  { id: "Até R$ 1.500", label: "Até R$ 1.500", icon: <Package className="w-4 h-4" /> },
                  { id: "Bateria 90%+", label: "Bateria 90%+", icon: <CheckCircle className="w-4 h-4" /> },
                  { id: "Garantia Válida", label: "Garantia Válida", icon: null },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition whitespace-nowrap border cursor-pointer border-slate-200 shadow-sm ${
                      selectedCategory === cat.id 
                      ? 'bg-slate-900 border-slate-900 text-white' 
                      : 'bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* Page Content Headers */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold font-title text-slate-900">Anúncios Recentes</h2>
                  <p className="text-sm text-slate-500">Eletrônicos inspecionados com procedência e garantia</p>
                </div>
                <span className="text-sm font-semibold text-[#2563eb] flex items-center gap-1.5 hover:underline cursor-pointer">
                  {loadingAds ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-slate-500 font-medium">Buscando ofertas reais...</span>
                    </>
                  ) : (
                    <span>{filteredProducts.length} itens encontrados</span>
                  )}
                </span>
              </div>

              {/* Empty Search Result feedback */}
              {!loadingAds && filteredProducts.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm my-8">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-800">Nenhum anúncio localizado</h3>
                  <p className="text-slate-500 max-w-md mx-auto text-sm mt-1">
                    Não encontramos nenhum produto que coincida com a categoria "{selectedCategory}" ou termo de busca "{searchQuery}". Tente redefinir os filtros.
                  </p>
                  <button 
                    onClick={() => { setSelectedCategory("Todos"); setSearchQuery(""); }}
                    className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition"
                  >
                    Limpar Filtros
                  </button>
                </div>
              )}

              {/* Products Grid / Skeletons */}
              {loadingAds ? (
                <div id="loading-skeletons" className="mb-12">
                  <ProductSkeletonGrid />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  {filteredProducts.map(product => {
                    const seller = users.find(u => u.id === product.userId);
                    return (
                      <div 
                        key={product.id}
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group hover:shadow-lg transition-all transform hover:-translate-y-1 relative duration-200 cursor-pointer"
                        onClick={() => navigate(`/anuncio/${product.id}`)}
                      >
                        {/* Image & tag wrapper */}
                        <div className="relative aspect-square overflow-hidden bg-slate-100">
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          
                          {/* Badges */}
                          {product.isFeatured && (
                            <span className="absolute top-3 left-3 bg-[#141b2b]/95 text-white text-[10px] uppercase font-extrabold px-2 py-0.5 rounded tracking-wide shadow-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span>Destaque</span>
                            </span>
                          )}
                          
                          {product.price <= 2000 && !product.isFeatured && (
                            <span className="absolute top-3 left-3 bg-rose-600 font-extrabold text-[#fff] text-[10px] uppercase px-2 py-0.5 rounded tracking-wide shadow-md">
                              Oportunidade
                            </span>
                          )}

                          {/* Battery Health Display Badge */}
                          {product.batteryHealth && (
                            <span className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-slate-800 text-[11px] font-bold px-2 py-1 rounded shadow-sm border border-slate-200">
                              Bateria: {product.batteryHealth}%
                            </span>
                          )}

                          {/* Botões de Ação para Criador do Anúncio */}
                          {currentUser && currentUser.id === product.userId && (
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-30">
                              <button
                                id={`btn-edit-${product.id}`}
                                title="Editar Anúncio"
                                onClick={(e) => handleEditAdClick(product, e)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg shadow-md duration-150 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-bold"
                              >
                                <Pencil className="w-3.5 h-3.5 shrink-0" />
                                <span>Editar</span>
                              </button>
                              <button
                                id={`btn-delete-${product.id}`}
                                title="Excluir Anúncio"
                                onClick={(e) => handleDeleteAd(product.id, e)}
                                className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg shadow-md duration-150 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Info block */}
                        <div className="p-4 flex flex-col justify-between h-44">
                          <div>
                            <div className="text-slate-500 text-xs flex items-center gap-1 mb-1 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{product.location}</span>
                            </div>

                            <h3 className="font-title font-bold text-base text-slate-900 group-hover:text-[#2563eb] leading-snug line-clamp-2 transition-colors">
                              {product.title}
                            </h3>
                          </div>

                          <div>
                            {/* Tags */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {product.storage && (
                                <span className="bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200">
                                  {product.storage}
                                </span>
                              )}
                              <span className="bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200">
                                {product.brand}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <p className="font-title font-bold text-lg text-[#004ac6]">
                                R$ {product.price.toLocaleString('pt-BR')}
                              </p>
                              <button className="bg-slate-100 hover:bg-[#2563eb] hover:text-white text-slate-700 p-2 rounded-lg transition-all transform translate-y-2 group-hover:translate-y-0 opacity-80 group-hover:opacity-100">
                                <ChevronRight className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Newsletter CTA Area */}
              <section className="bg-[#2563eb] text-white rounded-2xl p-8 sm:p-12 mb-12 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 -translate-y-12 translate-x-12 opacity-10 pointer-events-none">
                  <Smartphone className="w-96 h-96" />
                </div>
                
                <div className="max-w-xl z-10">
                  <h2 className="font-title text-2xl sm:text-3xl font-bold tracking-tight mb-2">Não perca a oferta perfeita.</h2>
                  <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
                    Assine para receber alertas de novos anúncios de iPhones, Samsung e outros smartphones seminovos inspecionados que cabem no seu orçamento.
                  </p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); setNewsletterSubscribed(true); }} className="w-full lg:w-auto flex flex-col sm:flex-row gap-3 z-10">
                  {!newsletterSubscribed ? (
                    <>
                      <input 
                        type="email" 
                        required
                        placeholder="Seu melhor e-mail"
                        value={newsletterEmail}
                        onChange={(e) => setNewsletterEmail(e.target.value)}
                        className="bg-white/15 border border-white/20 text-white placeholder-white/60 focus:bg-white focus:text-slate-950 focus:ring-2 focus:ring-white/50 rounded-lg px-4 py-3 text-sm flex-grow md:w-80 outline-none transition"
                      />
                      <button type="submit" className="bg-white text-[#2563eb] hover:bg-blue-50 px-6 py-3 rounded-lg font-bold text-sm transition active:scale-95 whitespace-nowrap shadow">
                        Assinar Alertas
                      </button>
                    </>
                  ) : (
                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-3.5 rounded-lg text-sm font-semibold text-emerald-300 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      <span>E-mail cadastrado! Você receberá alertas do ElectroMarket.</span>
                    </div>
                  )}
                </form>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 transform animate-in fade-in zoom-in-95 duration-200">
            <div className="relative aspect-[16/10] sm:aspect-[21/9] bg-slate-100">
              <img 
                src={selectedProduct.images[0]} 
                alt={selectedProduct.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
                    <span className="bg-[#2563eb]/10 text-[#2563eb] font-semibold px-2 py-0.5 rounded">
                      Smartphones &gt; {selectedProduct.brand}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedProduct.location}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold font-title text-slate-900 leading-tight">
                    {selectedProduct.title}
                  </h3>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-xs text-slate-400 block font-medium">Preço à vista</span>
                  <span className="text-2xl font-black font-title text-[#004ac6]">
                    R$ {selectedProduct.price.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 py-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold tracking-wider">Marca</span>
                  <span className="text-sm font-semibold text-slate-800">{selectedProduct.brand}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold tracking-wider">Modelo</span>
                  <span className="text-sm font-semibold text-slate-800">{selectedProduct.model}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold tracking-wider">Saúde Bateria</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {selectedProduct.batteryHealth ? `${selectedProduct.batteryHealth}%` : "Excelente/Nova"}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold tracking-wider">Armazenamento</span>
                  <span className="text-sm font-semibold text-slate-800">{selectedProduct.storage || "N/A"}</span>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-xs uppercase text-slate-400 font-bold tracking-wide mb-1">Descrição do Anunciante</h4>
                <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-150 font-sans">
                  {selectedProduct.description}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-3 justify-end">
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold text-sm"
                >
                  Fechar
                </button>
                <button 
                  onClick={() => startChatForProduct(selectedProduct)}
                  className="bg-[#2563eb] text-white hover:bg-blue-700 px-5 py-2.5 rounded-lg font-bold text-sm shadow transition flex items-center gap-1.5"
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span>Negociar no Chat (Database Sim)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Announce (Create Product) Modal */}
      {showAnnounceModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 transform animate-in fade-in duration-205 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#2563eb]" />
                <h3 className="font-title font-bold text-lg">Criar Novo Anúncio</h3>
              </div>
              <button onClick={() => setShowAnnounceModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAd} className="p-6 gap-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Título do Anúncio *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: iPhone 14 Pro Max Excelente Estado"
                  value={newAd.title}
                  onChange={(e) => setNewAd({...newAd, title: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Marca *
                  </label>
                  <select 
                    value={newAd.brand}
                    onChange={(e) => setNewAd({...newAd, brand: e.target.value})}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]"
                  >
                    <option value="Apple">Apple (iPhone)</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Xiaomi">Xiaomi</option>
                    <option value="Google">Google</option>
                    <option value="Motorola">Motorola</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Modelo do Aparelho *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: iPhone 14 Pro Max"
                    value={newAd.model}
                    onChange={(e) => setNewAd({...newAd, model: e.target.value})}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Preço (R$) *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: 4200"
                    value={newAd.price}
                    onChange={(e) => setNewAd({...newAd, price: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Saúde Bateria (%)
                  </label>
                  <input 
                    type="number" 
                    min="50"
                    max="100"
                    placeholder="85"
                    value={newAd.batteryHealth}
                    onChange={(e) => setNewAd({...newAd, batteryHealth: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Armazenamento
                  </label>
                  <select
                    value={newAd.storage}
                    onChange={(e) => setNewAd({...newAd, storage: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]"
                  >
                    <option value="64GB">64GB</option>
                    <option value="128GB">128GB</option>
                    <option value="256GB">256GB</option>
                    <option value="512GB">512GB</option>
                    <option value="1TB">1TB</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Localização (Cidade, UF) *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: São Paulo, SP"
                  value={newAd.location}
                  onChange={(e) => setNewAd({...newAd, location: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]"
                />
              </div>

              {/* Photos area supporting draggable upload via Cloudinary & fallback presets */}
              <div className="mb-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 text-left">
                  Fotos do Aparelho (Upload Cloudinary)
                </label>
                
                <div className="flex flex-col items-center justify-center py-4 px-2 border-2 border-dashed border-slate-200 bg-white rounded-lg hover:bg-slate-100/50 transition relative cursor-pointer group">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        const filesArray = Array.from(e.target.files);
                        setSelectedImageFiles(prev => [...prev, ...filesArray].slice(0, 5));
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <PlusCircle className="w-8 h-8 text-blue-500 mb-1.5 group-hover:scale-105 transition duration-150" />
                  <span className="text-xs font-semibold text-slate-700">Escolher ou arrastar fotos</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Até 5 fotos (JPG, PNG, WEBP)</span>
                </div>

                {selectedImageFiles.length > 0 ? (
                  <div className="mt-3 text-left space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Arquivos selecionados ({selectedImageFiles.length}):</span>
                    {selectedImageFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 shadow-xs">
                        <span className="truncate max-w-[240px] font-mono text-[11px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedImageFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-[10px] uppercase font-bold tracking-wider hover:underline ml-2"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    <p className="text-[10.5px] text-emerald-600 font-semibold flex items-center gap-1 mt-2">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Fotos prontas para upload via Cloudinary!</span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 text-left border-t border-slate-200 pt-2.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 leading-normal">
                      Ou use Preset como Fallback se preferir não subir arquivos
                    </label>
                    <select 
                      value={newAd.imagePreset}
                      onChange={(e) => setNewAd({...newAd, imagePreset: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-1 focus:ring-[#2563eb]"
                    >
                      <option value="https://lh3.googleusercontent.com/aida-public/AB6AXuC43OzvIdjYk28qZ-NdeKucLaaTJmVG0FxvCcmIax7R-PLOd0QI_BLz74ds0_zluD2-puXWgboxH94dGqqkq1-3SvuZJikcfjIqIZ9K-f6WxqMQ85ZwQLuvzJjmfxvffVuueWe3zEwqrJfxC5v-IbHpMOTIpZlCKIlAhj9CsgF3KH81JfkABaANSgXhBH8aBTg4LqSAe40ZxuC2VzN8wgvUGrL31FNN-xQ4b9LVLNb0zhrKvVKdL4UMI3HSTLCOmhTiHtAcqR0XL9ht">iPhone Preset</option>
                      <option value="https://lh3.googleusercontent.com/aida-public/AB6AXuBp6MX-rQosrE7hr4MRqk76ezQ692T72Fbg6UFynfH3X-Ag96Lf5brEGGzIOeaLHZNXnLQSvthqzUSfMcaL_KDVuvn0O1liA83wfGoJzQmdpdaSjbVa_X9Uj3WOTeaFPO8ecfaB6YgRaHWw_DbNRhxuYf7SPW5zy65EE7aPMtBZFroiQTQq7Vo-LYBR53FP9gxE6ivwc6k-4ZlYEHCx9x5A4ncAUkKcdfi161D-RLdZqYZ2psIj1HMaZRBecdPxoRqHCi1vHe3gmHmJ">Galaxy Preset</option>
                      <option value="https://lh3.googleusercontent.com/aida-public/AB6AXuDylhGhSPFzQ1UaObLEzMyneaTBT7yjrjigPKCvN_NLxj7aVPW8xVLaaInLW-T9SqjIeLJEIWdbt6r9bqJpEaLqbov-m1cPpfC2R6wyPJ2qui-5AU6GbJ9qMMl1kXBMlX0YC3WFFyqDI5xDiAKIHotAAzUp6bbIqKOpDykPMSnAdYv4fojkmwBtJ_Jlgox61e5aEwG5qmBRlZ-F4olg62J6VD_2JWX250vH08kZBU6sIim6sAru5MTGvwpNNu0KnM7P2N5NSAGUZL2y">Pixel Preset</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Descrição Detalhada do Estado
                </label>
                <textarea 
                  rows={3}
                  placeholder="Descreva defeitos, acessórios inclusos, e condições gerais para simular na base."
                  value={newAd.description}
                  onChange={(e) => setNewAd({...newAd, description: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]"
                />
              </div>

              <div className="mb-4 flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-150">
                <input 
                  type="checkbox"
                  id="featured-check"
                  checked={newAd.isFeatured}
                  onChange={(e) => setNewAd({...newAd, isFeatured: e.target.checked})}
                  className="rounded text-[#2563eb] focus:ring-[#2563eb] w-4.5 h-4.5"
                />
                <label htmlFor="featured-check" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Marcar como "Destaque" (Adiciona fita especial no card do marketplace)
                </label>
              </div>

              <div className="p-4 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 flex items-start gap-2 mb-4 leading-relaxed">
                <Info className="w-4.5 h-4.5 shrink-0 text-[#2563eb] mt-0.5" />
                <div>
                  <strong>Identidade do Vendedor (PostgreSQL via Prisma):</strong> O anúncio será gravado com o seu 
                  User ID <code>{currentUser ? currentUser.id : "user-buyer-1"}</code> ({currentUser ? currentUser.email : "Carol Santos"}), vinculando a chave estrangeira <code>userId</code> diretamente à tabela <code>User</code>.
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowAnnounceModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-[#2563eb] text-white hover:bg-blue-700 px-6 py-2 rounded-lg font-bold text-sm shadow"
                >
                  Salvar e Inserir no Banco
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ad Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 transform animate-in fade-in duration-205 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-500" />
                <h3 className="font-title font-bold text-lg">Editar Anúncio</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedAd} className="p-6 gap-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Título do Anúncio *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: iPhone 14 Pro Max Excelente Estado"
                  value={editAdData.title}
                  onChange={(e) => setEditAdData({...editAdData, title: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Marca *
                  </label>
                  <select 
                    value={editAdData.brand}
                    onChange={(e) => setEditAdData({...editAdData, brand: e.target.value})}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="Apple">Apple (iPhone)</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Xiaomi">Xiaomi</option>
                    <option value="Google">Google</option>
                    <option value="Motorola">Motorola</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Modelo do Aparelho *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: iPhone 14 Pro Max"
                    value={editAdData.model}
                    onChange={(e) => setEditAdData({...editAdData, model: e.target.value})}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Preço (R$) *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: 4200"
                    value={editAdData.price}
                    onChange={(e) => setEditAdData({...editAdData, price: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Saúde Bateria (%)
                  </label>
                  <input 
                    type="number" 
                    min="50"
                    max="100"
                    placeholder="85"
                    value={editAdData.batteryHealth}
                    onChange={(e) => setEditAdData({...editAdData, batteryHealth: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Armazenamento
                  </label>
                  <select
                    value={editAdData.storage}
                    onChange={(e) => setEditAdData({...editAdData, storage: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="64GB">64GB</option>
                    <option value="128GB">128GB</option>
                    <option value="256GB">256GB</option>
                    <option value="512GB">512GB</option>
                    <option value="1TB">1TB</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Localização (Cidade, UF) *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: São Paulo, SP"
                  value={editAdData.location}
                  onChange={(e) => setEditAdData({...editAdData, location: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="mb-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 text-left">
                  Preset de Imagem do Aparelho
                </label>
                <select 
                  value={editAdData.imagePreset}
                  onChange={(e) => setEditAdData({...editAdData, imagePreset: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="https://lh3.googleusercontent.com/aida-public/AB6AXuC43OzvIdjYk28qZ-NdeKucLaaTJmVG0FxvCcmIax7R-PLOd0QI_BLz74ds0_zluD2-puXWgboxH94dGqqkq1-3SvuZJikcfjIqIZ9K-f6WxqMQ85ZwQLuvzJjmfxvffVuueWe3zEwqrJfxC5v-IbHpMOTIpZlCKIlAhj9CsgF3KH81JfkABaANSgXhBH8aBTg4LqSAe40ZxuC2VzN8wgvUGrL31FNN-xQ4b9LVLNb0zhrKvVKdL4UMI3HSTLCOmhTiHtAcqR0XL9ht">iPhone Preset</option>
                  <option value="https://lh3.googleusercontent.com/aida-public/AB6AXuBp6MX-rQosrE7hr4MRqk76ezQ692T72Fbg6UFynfH3X-Ag96Lf5brEGGzIOeaLHZNXnLQSvthqzUSfMcaL_KDVuvn0O1liA83wfGoJzQmdpdaSjbVa_X9Uj3WOTeaFPO8ecfaB6YgRaHWw_DbNRhxuYf7SPW5zy65EE7aPMtBZFroiQTQq7Vo-LYBR53FP9gxE6ivwc6k-4ZlYEHCx9x5A4ncAUkKcdfi161D-RLdZqYZ2psIj1HMaZRBecdPxoRqHCi1vHe3gmHmJ">Galaxy Preset</option>
                  <option value="https://lh3.googleusercontent.com/aida-public/AB6AXuDylhGhSPFzQ1UaObLEzMyneaTBT7yjrjigPKCvN_NLxj7aVPW8xVLaaInLW-T9SqjIeLJEIWdbt6r9bqJpEaLqbov-m1cPpfC2R6wyPJ2qui-5AU6GbJ9qMMl1kXBMlX0YC3WFFyqDI5xDiAKIHotAAzUp6bbIqKOpDykPMSnAdYv4fojkmwBtJ_Jlgox61e5aEwG5qmBRlZ-F4olg62J6VD_2JWX250vH08kZBU6sIim6sAru5MTGvwpNNu0KnM7P2N5NSAGUZL2y">Pixel Preset</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Descrição Detalhada do Estado
                </label>
                <textarea 
                  rows={3}
                  placeholder="Descreva defeitos, acessórios inclusos, e condições gerais para simular na base."
                  value={editAdData.description}
                  onChange={(e) => setEditAdData({...editAdData, description: e.target.value})}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="mb-4 flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-150">
                <input 
                  type="checkbox"
                  id="edit-featured-check"
                  checked={editAdData.isFeatured}
                  onChange={(e) => setEditAdData({...editAdData, isFeatured: e.target.checked})}
                  className="rounded text-blue-600 focus:ring-blue-600 w-4.5 h-4.5"
                />
                <label htmlFor="edit-featured-check" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Marcar como "Destaque" (Adiciona fita especial no card do marketplace)
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2 rounded-lg font-bold text-sm shadow"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Login Modal (Supabase integrated) */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 transform animate-in fade-in zoom-in-95 duration-200 animate-duration-200">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#2563eb]" />
                <h3 className="font-title font-bold text-base">Acesse sua Conta</h3>
              </div>
              <button 
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5">
              <div className="text-center">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 border border-blue-100">
                  <Flame className="w-6 h-6 fill-blue-600" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Bem-vindo ao ElectroMarket</h4>
                <p className="text-xs text-slate-500 mt-1">Conecte-se para gerenciar seus chats e criar anúncios reais.</p>
              </div>

              {/* Real Google Button requested by user */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition shadow-sm cursor-pointer hover:shadow-md duration-150 active:scale-95"
              >
                {/* Embedded SVG Google Icon for beautiful visual accuracy */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continuar com o Google</span>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider text-[10px]">Ou use e-mail de demonstração</span>
                </div>
              </div>

              {/* Demo Login (Carol Santos) */}
              <button
                type="button"
                onClick={() => {
                  setCurrentUser(INITIAL_USERS[0]);
                  setShowLoginModal(false);
                }}
                className="w-full bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5 duration-150 active:scale-95 animate-duration-150"
              >
                <span>Entrar como Carol Santos (Demo)</span>
              </button>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-[10.5px] text-slate-500 leading-normal flex items-start gap-1.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Configuração Supabase:</strong> Este fluxo usa <code>@supabase/supabase-js</code>. 
                  Lembre-se de fornecer <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nas variáveis de ambiente da Vercel ou local.
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      
      {/* Dynamic Negotiation Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl h-[550px] shadow-2xl border border-slate-200 flex flex-col transform animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-[#2563eb] text-white p-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <div>
                  <h3 className="font-title font-bold text-base leading-tight">Chat de Negociação</h3>
                  <p className="text-[11px] text-blue-105 font-medium">Converse diretamente com o vendedor</p>
                </div>
              </div>
              <button 
                onClick={() => setShowChatModal(false)}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
              <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Canal de Chat Ativo</span>
                <select 
                  value={activeChatId || ""}
                  onChange={(e) => setActiveChatId(e.target.value || null)}
                  className="text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none font-semibold text-slate-700 cursor-pointer"
                >
                  {chats.map(chat => {
                    const buyerObj = users.find(u => u.id === chat.buyerId);
                    const prodObj = products.find(p => p.id === chat.productId);
                    return (
                      <option key={chat.id} value={chat.id}>
                        {buyerObj?.name || 'Comprador'} - {prodObj?.title || 'Produto'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Message Box */}
              <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-white min-h-0 animate-in fade-in duration-200">
                {activeChatId ? (
                  (Array.isArray(messages) ? messages : [])
                    .filter(m => m && m.chatId === activeChatId)
                    .map(msg => {
                      const isMe = msg.senderId === (currentUser ? currentUser.id : "user-buyer-1"); // My profile (Carol Santos)
                      const senderObj = users.find(u => u.id === msg.senderId);
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-paragraph p-3.5 text-xs shadow-sm ${
                          isMe 
                          ? 'bg-[#2563eb] text-white rounded-br-none rounded-2xl' 
                          : 'bg-slate-100 text-slate-800 rounded-bl-none rounded-2xl border border-slate-200'
                        }`}>
                          <div className="font-bold mb-0.5 text-[10px] opacity-80 flex items-center gap-1">
                            <span>{senderObj?.name || 'Usuário'}</span>
                            {isMe && <span className="bg-blue-800 text-white text-[8px] px-1 rounded">Você</span>}
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          <span className="text-[8px] opacity-60 block text-right mt-1 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 text-sm gap-2">
                    <MessageSquare className="w-10 h-10 text-slate-300" />
                    <span>Nenhum chat de negociação ativo.</span>
                    <span className="text-xs text-slate-400 max-w-xs text-center font-normal">Selecione um produto no catálogo e clique em "Negociar no Chat" para iniciar uma conversa direta com o vendedor!</span>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              {activeChatId && (
                <form onSubmit={handleSendMessage} className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2 rounded-b-2xl">
                  <input 
                    type="text" 
                    placeholder="Digite sua mensagem de negociação ou proposta..."
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    className="flex-grow px-4 py-2 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-[#2563eb]/25 focus:border-[#2563eb] transition-all"
                  />
                  <button type="submit" className="bg-[#2563eb] text-white p-2 px-4 rounded-xl hover:bg-blue-700 transition font-bold text-sm flex items-center gap-1.5 shadow-md active:scale-95 duration-100 cursor-pointer">
                    <Send className="w-4 h-4" />
                    <span>Enviar</span>
                  </button>
                </form>
              )}
            </div>
            
          </div>
        </div>
      )}

      {/* Styled Site Footer */}
      <footer className="bg-slate-900 text-slate-400 pt-12 pb-6 mt-auto border-t border-slate-800 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-white">
              <div className="bg-[#2563eb] p-1.5 rounded-lg text-white">
                <Flame className="w-5 h-5 fill-white" />
              </div>
              <span className="text-lg font-bold font-title tracking-tight">ElectroMarket</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              O marketplace premium focado em eletrônicos de alta performance e procedência inspecionada.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <h4 className="font-semibold text-white uppercase text-xs tracking-wider">Suporte</h4>
            <ul className="flex flex-col gap-1.5 text-xs">
              <li><a href="#" className="hover:text-white transition">Central de Ajuda</a></li>
              <li><a href="#" className="hover:text-white transition">Como Comprar</a></li>
              <li><a href="#" className="hover:text-white transition">Regras de Venda</a></li>
              <li><a href="#" className="hover:text-white transition">Contato</a></li>
            </ul>
          </div>

          <div className="flex flex-col gap-2.5">
            <h4 className="font-semibold text-white uppercase text-xs tracking-wider">Categorias</h4>
            <ul className="flex flex-col gap-1.5 text-xs">
              <li><a href="#" className="hover:text-white transition">iPhones Seminovos</a></li>
              <li><a href="#" className="hover:text-white transition">MacBooks & iPads</a></li>
              <li><a href="#" className="hover:text-white transition">Smartwatches</a></li>
              <li><a href="#" className="hover:text-white transition">Acessórios Premium</a></li>
            </ul>
          </div>

          <div className="flex flex-col gap-2.5">
            <h4 className="font-semibold text-white uppercase text-xs tracking-wider">Dicas de Segurança</h4>
            <ul className="flex flex-col gap-1.5 text-xs">
              <li><a href="#" className="hover:text-white transition">Verificação de IMEI</a></li>
              <li><a href="#" className="hover:text-white transition">Pagamento Seguro</a></li>
              <li><a href="#" className="hover:text-white transition">Encontros em Local Público</a></li>
              <li><a href="#" className="hover:text-white transition">Dicas Gerais de Fraude</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <p>© 2026 ElectroMarket Premium. Todos os direitos reservados. Projetado para Postgres e Prisma DSL.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition">Política de Privacidade</a>
            <a href="#" className="hover:text-white transition">Termos de Serviço</a>
            <a href="#" className="hover:text-white transition">Segurança do Banco</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
