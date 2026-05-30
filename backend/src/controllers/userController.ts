import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';

export const getMyProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    const products = await prisma.product.findMany({
      where: {
        userId: userId,
      },
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

    res.status(200).json(products);
  } catch (error: any) {
    console.error("Erro ao buscar anúncios do próprio usuário:", error);
    res.status(500).json({
      error: 'Erro ao buscar seus anúncios',
      details: error.message
    });
  }
};
