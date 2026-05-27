import { Response } from 'express';
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

    // Se o sellerId não foi enviado, podemos buscar o dono do produto
    let sellerId = bodySellerId;
    if (!sellerId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { userId: true }
      });

      if (!product) {
        res.status(404).json({ error: 'Produto associado ao chat não encontrado' });
        return;
      }
      sellerId = product.userId;
    }

    // Evitar que um usuário abra um chat consigo mesmo
    if (buyerId === sellerId) {
      res.status(400).json({ error: 'Você não pode iniciar um chat com o seu próprio anúncio' });
      return;
    }

    // Buscar se já existe uma conversa única entre esse comprador, vendedor e produto
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

    // Se não existir, criamos o registro do chat
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

    res.status(200).json(chat);
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao obter ou criar sala de chat',
      details: error.message
    });
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
          take: 1, // Retorna a última mensagem trocada para o preview da lista
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(chats);
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao listar chats do usuário',
      details: error.message
    });
  }
};

// 3. Puxar o histórico de mensagens de um chat específico, ordenado por data
export const getChatMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // chatId
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
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
        }
      }
    });

    if (!chat) {
      res.status(404).json({ error: 'Conversa não encontrada' });
      return;
    }

    // Verificar se o usuário participa desta conversa
    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      res.status(403).json({ error: 'Você não tem permissão para ler as mensagens deste chat' });
      return;
    }

    res.status(200).json(chat.messages);
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao buscar o histórico de mensagens',
      details: error.message
    });
  }
};
