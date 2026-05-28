import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';

// 1. Criar um anúncio associado ao ID do usuário autenticado
export const createAd = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, price, brand, model, batteryHealth, storage, images, location, isFeatured, userId: bodyUserId } = req.body;
    const userId = req.userId || bodyUserId;

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

    // Determine final image URLs (supporting either Cloudinary multipart uploads or raw JSON URL inputs)
    let imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      imageUrls = (req.files as any[]).map(file => file.path || file.secure_url || file.url);
    } else {
      imageUrls = Array.isArray(images) ? images : [];
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
        images: imageUrls,
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
};
