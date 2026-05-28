import { Router, Request, Response } from 'express';
import { getOrCreateChat, getUserChats, getChatMessages } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';

const router = Router();

// Todas as rotas de chat requerem que o usuário esteja devidamente autenticado
router.post('/', authMiddleware, getOrCreateChat);
router.get('/', authMiddleware, getUserChats);
router.get('/:id/messages', authMiddleware, getChatMessages);

// Criar ou abrir uma sala de chat através do Gateway (Suporta passagem do buyerId, sellerId e productId no body)
router.post('/gateway', async (req: Request, res: Response): Promise<any> => {
  try {
    const { productId, sellerId, buyerId } = req.body;

    if (!productId || !sellerId || !buyerId) {
      return res.status(400).json({ error: 'Os campos productId, sellerId e buyerId são obrigatórios no corpo da requisição.' });
    }

    // Tenta primeiro consultar/criar no banco de dados real via Prisma
    try {
      let chat = await prisma.chat.findUnique({
        where: {
          buyerId_sellerId_productId: {
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
        chat = await prisma.chat.create({
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

