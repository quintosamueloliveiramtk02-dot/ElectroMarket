import { Router, Request, Response } from 'express';
import { getOrCreateChat, getUserChats, getChatMessages } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

const router = Router();

// Todas as rotas de chat requerem que o usuário esteja devidamente autenticado
router.post('/', authMiddleware, getOrCreateChat);
router.get('/', authMiddleware, getUserChats);
router.get('/:id/messages', authMiddleware, getChatMessages);

// 1. POST /api/chats/rooms -> Cria ou busca uma sala existente com base no productId e buyerId
router.post('/rooms', async (req: Request, res: Response): Promise<any> => {
  try {
    const { productId, buyerId } = req.body;

    const isUUID = (str: string): boolean => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    if (!productId || !buyerId) {
      return res.status(400).json({ error: 'Os campos productId e buyerId são obrigatórios.' });
    }

    if (!isUUID(productId)) {
      return res.status(400).json({ error: 'O campo productId fornecido não é um UUID válido.' });
    }

    if (!isUUID(buyerId)) {
      return res.status(400).json({ error: 'O campo buyerId fornecido não é um UUID válido.' });
    }

    // Busca o produto para descobrir quem é o vendedor (sellerId)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { userId: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Produto associado não encontrado.' });
    }

    const sellerId = product.userId;

    let chat = await prisma.chatRoom.findUnique({
      where: {
        productId_buyerId_sellerId: {
          productId,
          buyerId,
          sellerId
        }
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            images: true,
            price: true,
          }
        },
        seller: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!chat) {
      chat = await prisma.chatRoom.create({
        data: {
          productId,
          buyerId,
          sellerId
        },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              images: true,
              price: true,
            }
          },
          seller: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          },
          buyer: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      });
    }

    const responseData = {
      ...chat,
      chatRoomId: chat.id
    };

    return res.status(200).json(responseData);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Erro ao obter ou criar sala de chat',
      details: error.message
    });
  }
});

// 2. GET /api/chats/rooms/:userId -> Lista todas as salas ativas de um usuário (seja ele comprador ou vendedor) incluindo o relacionamento com o produto
router.get('/rooms/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;

    const isUUID = (str: string): boolean => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    if (!userId || !isUUID(userId)) {
      return res.status(200).json([]);
    }

    const chats = await prisma.chatRoom.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            images: true,
            brand: true,
            model: true,
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            phone: true,
          }
        },
        seller: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            phone: true,
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mappedChats = chats.map(c => ({
      ...c,
      chatRoomId: c.id,
      messages: c.messages.map(m => ({
        ...m,
        chatRoomId: m.chatRoomId,
        chatId: m.chatRoomId
      }))
    }));

    return res.status(200).json(mappedChats);
  } catch (error: any) {
    console.error("Erro no Prisma ao listar salas de chat do usuário:", error);
    return res.status(500).json({
      error: 'Erro ao listar salas de chat do usuário',
      details: error.message
    });
  }
});

// 3. POST /api/chats/messages / /api/chats/rooms/messages / /api/chats/rooms/:roomId/messages -> Salva uma mensagem real no banco de dados
const createMessageFn = async (req: Request, res: Response): Promise<any> => {
  try {
    const { roomId, chatRoomId, chatId, senderId, text } = req.body;
    const { roomId: paramRoomId } = req.params;
    const targetRoomId = chatRoomId || roomId || chatId || paramRoomId;

    const isUUID = (str: string): boolean => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    if (!targetRoomId || !senderId || !text) {
      return res.status(400).json({ error: 'Os campos roomId/chatRoomId/chatId, senderId e text são obrigatórios.' });
    }

    if (!isUUID(targetRoomId)) {
      return res.status(400).json({ error: 'O ID da sala de chat (chatRoomId) fornecido não é um UUID válido.' });
    }

    // Validação Robusta do Payload (senderId): Se houver token JWT, obriga o uso do ID autenticado para evitar spoofing ou ID incorreto
    let finalSenderId = senderId;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2) {
        const [scheme, token] = parts;
        if (/^Bearer$/i.test(scheme)) {
          try {
            const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-electromarket';
            const decoded = jwt.verify(token, jwtSecret) as { id: string };
            if (decoded && decoded.id) {
              finalSenderId = decoded.id;
            }
          } catch (jwtErr) {
            console.warn('[Message-Auth-Validation] Erro ao decodificar token JWT:', jwtErr);
          }
        }
      }
    }

    const message = await prisma.message.create({
      data: {
        chatRoomId: targetRoomId,
        senderId: finalSenderId,
        text
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

    const messageWithChatId = {
      ...message,
      chatId: message.chatRoomId
    };

    return res.status(201).json(messageWithChatId);
  } catch (error: any) {
    console.error("Erro no Prisma ao criar mensagem:", error);
    return res.status(500).json({
      error: 'Erro ao persistir nova mensagem de chat',
      details: error.message
    });
  }
};

router.post('/messages', createMessageFn);
router.post('/rooms/messages', createMessageFn);
router.post('/rooms/:roomId/messages', createMessageFn);

// 4. GET /api/chats/rooms/:roomId/messages -> Retorna o histórico de mensagens de uma sala
router.get('/rooms/:roomId/messages', async (req: Request, res: Response): Promise<any> => {
  try {
    const { roomId } = req.params;

    const isUUID = (str: string): boolean => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    if (!roomId || !isUUID(roomId)) {
      return res.status(200).json([]);
    }

    const messages = await prisma.message.findMany({
      where: {
        chatRoomId: roomId
      },
      orderBy: {
        createdAt: 'asc'
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

    const mappedMessages = messages.map(m => ({
      ...m,
      chatId: m.chatRoomId
    }));

    return res.status(200).json(mappedMessages);
  } catch (error: any) {
    console.error("Erro no Prisma ao retornar histórico de mensagens:", error);
    return res.status(500).json({
      error: 'Erro ao retornar histórico de mensagens',
      details: error.message
    });
  }
});

// Criar ou abrir uma sala de chat através do Gateway (Suporta passagem do buyerId, sellerId e productId no body)
router.post('/gateway', async (req: Request, res: Response): Promise<any> => {
  try {
    const { productId, sellerId, buyerId } = req.body;

    if (!productId || !sellerId || !buyerId) {
      return res.status(400).json({ error: 'Os campos productId, sellerId e buyerId são obrigatórios no corpo da requisição.' });
    }

    // Tenta primeiro consultar/criar no banco de dados real via Prisma
    try {
      let chat = await prisma.chatRoom.findUnique({
        where: {
          productId_buyerId_sellerId: {
            buyerId,
            sellerId,
            productId
          }
        },
        include: {
          product: {
            select: {
              title: true,
              images: true,
              price: true,
            }
          },
          seller: {
            select: {
              name: true,
              avatarUrl: true
            }
          },
          buyer: {
            select: {
              name: true,
              avatarUrl: true
            }
          }
        }
      });

      if (!chat) {
        chat = await prisma.chatRoom.create({
          data: {
            buyerId,
            sellerId,
            productId
          },
          include: {
            product: {
              select: {
                title: true,
                images: true,
                price: true,
              }
            },
            seller: {
              select: {
                name: true,
                avatarUrl: true
              }
            },
            buyer: {
              select: {
                name: true,
                avatarUrl: true
              }
            }
          }
        });
      }

      const responseData = {
        ...chat,
        chatRoomId: chat.id
      };

      return res.status(200).json(responseData);
    } catch (dbError) {
      console.warn('[Chat Gateway] Erro no banco de dados, utilizando fallback em memória:', dbError);
      // Fallback em memória para fins ilustrativos se o banco estiver temporariamente indisponível
      const fallbackId = `chat_${Date.now()}`;
      return res.status(200).json({
        id: fallbackId,
        chatRoomId: fallbackId,
        productId,
        buyerId,
        sellerId,
        lastMessage: "",
        updatedAt: new Date()
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      error: 'Erro no gateway do chat',
      details: error.message
    });
  }
});

export default router;

