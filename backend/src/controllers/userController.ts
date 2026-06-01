import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

// Configure standard Cloudinary credentials from process.env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'electromarket-demo',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

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

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    // Convert raw Buffer memory storage file to a data URL for secure Cloudinary upload
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = "data:" + (file.mimetype || "image/jpeg") + ";base64," + b64;
    
    // Upload image with optimized settings to fit an avatar circle
    const cldRes = await cloudinary.uploader.upload(dataURI, {
      folder: 'electromarket-avatars',
      transformation: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }],
    });

    res.status(200).json({ url: cldRes.secure_url });
  } catch (error: any) {
    console.error("Erro ao fazer upload de imagem do perfil para Cloudinary:", error);
    res.status(500).json({
      error: 'Erro no upload para o Cloudinary',
      details: error.message
    });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Não autorizado' });
      return;
    }

    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      res.status(400).json({ error: 'URL do avatar é obrigatória' });
      return;
    }

    // Persist to PostgreSQL via Prisma
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
      }
    });

    res.status(200).json(updatedUser);
  } catch (error: any) {
    console.error("Erro ao atualizar dados do perfil:", error);
    res.status(500).json({
      error: 'Erro ao atualizar dados do perfil',
      details: error.message
    });
  }
};
