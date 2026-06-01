import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'electromarket-demo',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

// 1. Criar um anúncio associado ao ID do usuário autenticado
export const createAd = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let { title, description, price, brand, model, batteryHealth, storage, images, location, city, uf, state, adCity, adUf, isFeatured, hasWarranty, userId: bodyUserId } = req.body;
    let userId = req.userId || bodyUserId;

    // Se a localização não foi enviada como string única, mas temos os campos Cidade / Estado separados
    if (!location) {
      const parts: string[] = [];
      const resolvedCity = city || adCity;
      const resolvedState = uf || state || adUf;
      if (resolvedCity) parts.push(resolvedCity);
      if (resolvedState) parts.push(resolvedState);
      if (parts.length > 0) {
        location = parts.join(", ");
      }
    }

    // Garantir ID de usuário válido para evitar falha por Integridade Referencial (Foreign Key)
    if (!userId) {
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        userId = defaultUser.id;
      } else {
        // Criação de um usuário de contingência para evitar que falhe caso o banco esteja vazio
        const dummyUser = await prisma.user.create({
          data: {
            id: "default-user-id",
            email: "default-user@electromarket.com",
            name: "Samuel Oliveira",
            passwordHash: "oauth-social-login-placeholder-default",
          }
        });
        userId = dummyUser.id;
      }
    } else {
      // 1. Aguardar a sincronização do usuário vindo do Supabase no banco de dados PostgreSQL
      let userExists = false;
      for (let attempt = 1; attempt <= 6; attempt++) {
        const existingUser = await prisma.user.findUnique({
          where: { id: userId }
        });
        if (existingUser) {
          userExists = true;
          break;
        }
        console.log(`[Ad-Create] Usuário ${userId} não encontrado no banco PostgreSQL. Tentativa ${attempt}/6. Aguardando 500ms para a sincronização completar...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Fallback: Se mesmo após as tentativas ainda não estiver cadastrado, criamos um registro provisório para não travar a criação do anúncio
      if (!userExists) {
        console.warn(`[Ad-Create] Usuário ${userId} não foi sincronizado a tempo. Aplicando fallback de criação automática de usuário...`);
        try {
          await prisma.user.create({
            data: {
              id: userId,
              email: req.body.userEmail || req.body.email || `vendedor-${userId}@electromarket.com`,
              name: req.body.userName || req.body.name || "Vendedor do ElectroMarket",
              phone: req.body.userPhone || req.body.phone || "(11) 99999-9999",
              avatarUrl: req.body.userAvatar || req.body.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120px&h=120px&q=80",
              passwordHash: "oauth-social-login-placeholder-fallback",
            }
          });
        } catch (fallbackCreateErr: any) {
          console.error("[Ad-Create] Erro ao criar usuário de fallback (talvez criado em paralelo por outra requisição):", fallbackCreateErr.message || fallbackCreateErr);
        }
      }
    }

    if (!title || price === undefined || price === null || !brand || !model || !location) {
      res.status(400).json({ error: 'Campos obrigatórios ausentes (title, price, brand, model, location)' });
      return;
    }

    const parsedPrice = parseFloat(price);
    const parsedBattery = batteryHealth ? parseInt(batteryHealth) : null;

    if (isNaN(parsedPrice)) {
      res.status(400).json({ error: 'O preço informado deve ser um número válido' });
      return;
    }

    // Garante que images seja um array válido de strings e remove qualquer valor nulo/undefined
    let validatedImages: string[] = [];

    if (Array.isArray(images)) {
      validatedImages = images.filter(img => img !== undefined && img !== null && img !== 'undefined');
    } else if (typeof images === 'string' && images) {
      validatedImages = [images];
    }

    // Se o frontend enviou arquivos físicos pelo FormData
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const file of req.files as any[]) {
        if (file.buffer) {
          const b64 = Buffer.from(file.buffer).toString("base64");
          const dataURI = "data:" + (file.mimetype || "image/jpeg") + ";base64," + b64;
          const cldRes = await cloudinary.uploader.upload(dataURI, {
            folder: "electromarket-products",
          });
          validatedImages.push(cldRes.secure_url);
        } else if (file.path || file.secure_url || file.url) {
          validatedImages.push(file.path || file.secure_url || file.url);
        }
      }
    }

    let ad;
    try {
      ad = await prisma.product.create({
        data: {
          userId,
          title: title || "Sem título",
          description: description || '',
          price: parsedPrice,
          brand: brand || "Genérico",
          model,
          batteryHealth: parsedBattery,
          storage: storage || null,
          images: validatedImages,
          location,
          isFeatured: !!isFeatured,
          hasWarranty: !!hasWarranty || title?.toLowerCase().includes('garantia') || description?.toLowerCase().includes('garantia') || false,
        }
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2022' || (dbError.message && dbError.message.includes('hasWarranty'))) {
        console.warn("Retrying Product.create without hasWarranty because the column doesn't exist in the remote database:", dbError.message);
        ad = await prisma.product.create({
          data: {
            userId,
            title: title || "Sem título",
            description: description || '',
            price: parsedPrice,
            brand: brand || "Genérico",
            model,
            batteryHealth: parsedBattery,
            storage: storage || null,
            images: validatedImages,
            location,
            isFeatured: !!isFeatured,
          } as any
        });
      } else {
        throw dbError;
      }
    }

    res.status(201).json({
      message: 'Anúncio publicado com sucesso!',
      ad,
    });
  } catch (error: any) {
    console.error("Ocorreu um erro ao criar o anúncio no banco de dados:");
    console.error(error);
    console.error("Erro detalhado do Prisma nos Anúncios:", JSON.stringify(error, null, 2));
    console.error("Mensagem do erro:", error.message || error);
    res.status(500).json({ error: "Erro interno ao criar anúncio", details: error.message });
  }
};

// 2. Filtrar e listar todos os anúncios públicos
export const getAllAds = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { brand, minPrice, maxPrice, storage, search, isFeatured, filter } = req.query;

    const whereClause: any = {};

    // Lógica de Filtros Avançados (Etapa 2)
    if (filter && typeof filter === 'string') {
      const activeF = filter.trim();
      if (activeF === 'iPhone' || activeF === 'Apple') {
        whereClause.brand = {
          in: ['Apple', 'iPhone'],
          mode: 'insensitive',
        };
      } else if (['Samsung', 'Xiaomi', 'Motorola'].includes(activeF)) {
        whereClause.brand = {
          equals: activeF,
          mode: 'insensitive',
        };
      } else if (activeF === 'Outros') {
        whereClause.brand = {
          notIn: ['Apple', 'iPhone', 'Samsung', 'Xiaomi', 'Motorola'],
          mode: 'insensitive',
        };
      } else if (activeF === 'Até R$ 1.500') {
        whereClause.price = {
          lte: 1500,
        };
      } else if (activeF === 'Bateria 90%+') {
        whereClause.batteryHealth = {
          gte: 90,
        };
      } else if (activeF === 'Garantia Válida') {
        whereClause.hasWarranty = true;
      }
    }

    // Filtro por Marca (se passar explicitamente e não conflitar)
    if (brand && typeof brand === 'string' && !whereClause.brand) {
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
    const { title, description, price, brand, model, batteryHealth, storage, images, location, isFeatured, hasWarranty } = req.body;

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
    if (hasWarranty !== undefined) {
      updatedData.hasWarranty = !!hasWarranty;
    } else if (title !== undefined || description !== undefined) {
      const checkTitle = title !== undefined ? title : ad.title;
      const checkDesc = description !== undefined ? description : ad.description;
      if (checkTitle && (checkTitle.toLowerCase().includes('garantia') || checkDesc.toLowerCase().includes('garantia'))) {
        updatedData.hasWarranty = true;
      }
    }

    let updatedAd;
    try {
      updatedAd = await prisma.product.update({
        where: { id },
        data: updatedData
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2022' || (dbError.message && dbError.message.includes('hasWarranty'))) {
        console.warn("Retrying Product.update without hasWarranty because the column doesn't exist in the remote database:", dbError.message);
        const { hasWarranty: _, ...dataWithoutWarranty} = updatedData;
        updatedAd = await prisma.product.update({
          where: { id },
          data: dataWithoutWarranty as any
        });
      } else {
        throw dbError;
      }
    }

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
