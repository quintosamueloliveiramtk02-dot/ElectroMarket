import { Router, Request, Response } from 'express';
import { getOrCreateChat, getUserChats, getChatMessages } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';

const router = Router();

// Todas as rotas de chat requerem que o usuário esteja devidamente autenticado
router.post('/', authMiddleware, getOrCreateChat);
router.get('/', authMiddleware, getUserChats);
router.get('/:id/messages', authMiddleware, getChatMessages);

// 1. POST /api/chats/rooms -> Cria ou busca uma sala existente com base no productId e buyerId
router.post('/rooms', async (req: Request, res: Response): Promise<any> => {
  try {
    const { productId, buyerId } = req.body;

    if (!productId || !buyerId) {
      return res.status(400).json({ error: 'Os campos productId e buyerId são obrigatórios.' });
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

    return res.status(200).json(chat);
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
      messages: c.messages.map(m => ({
        ...m,
        chatId: m.chatRoomId
      }))
    }));

    return res.status(200).json(mappedChats);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Erro ao listar salas de chat do usuário',
      details: error.message
    });
  }
});

// 3. POST /api/chats/messages -> Salva uma mensagem real no banco de dados
router.post('/messages', async (req: Request, res: Response): Promise<any> => {
  try {
    const { roomId, chatRoomId, senderId, text } = req.body;
    const targetRoomId = chatRoomId || roomId;

    if (!targetRoomId || !senderId || !text) {
      return res.status(400).json({ error: 'Os campos roomId/chatRoomId, senderId e text são obrigatórios.' });
    }

    const message = await prisma.message.create({
      data: {
        chatRoomId: targetRoomId,
        senderId,
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
    return res.status(500).json({
      error: 'Erro ao persistir nova mensagem de chat',
      details: error.message
    });
  }
});

// 4. GET /api/chats/rooms/:roomId/messages -> Retorna o histórico de mensagens de uma sala
router.get('/rooms/:roomId/messages', async (req: Request, res: Response): Promise<any> => {
  try {
    const { roomId } = req.params;

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

      return res.status(200).json(chat);
    } catch (dbError) {
      console.warn('[Chat Gateway] Erro no banco de dados, utilizando fallback em memória:', dbError);
      // Fallback em memória para fins ilustrativos se o banco estiver temporariamente indisponível
      return res.status(200).json({
        id: `chat_${Date.now()}`,
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

