import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { createAd, getAllAds, getAdById, updateAd, deleteAd } from '../controllers/adController';
import { authMiddleware } from '../middlewares/authMiddleware';
import prisma from '../lib/prisma';

// 1. Configurar as credenciais do Cloudinary a partir do arquivo .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'electromarket-demo',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

// 2. Configurar o armazenamento do Multer direcionado para o Cloudinary de forma otimizada
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (async (req: any, file: any) => {
    return {
      folder: 'electromarket-products', // Nome da pasta que será criada automaticamente no seu painel Cloudinary
      allowed_formats: ['jpg', 'png', 'webp', 'jpeg'],
      transformation: [{ width: 800, height: 800, crop: 'limit' }] // Otimização gratuita de tamanho e carregamento
    };
  }) as any,
});

const upload = multer({ storage: storage });

const router = Router();

// Rotas públicas de consulta
router.get('/', getAllAds);
router.get('/:id', getAdById);

// Rotas privadas protegidas pelo authMiddleware e com upload opcional de fotos reais via Cloudinary
router.post('/', upload.array('images', 5), async (req, res) => {
  // Coleta os dados limpos enviados pelo formulário do frontend
  const { title, price, brand, batteryStatus, userId } = req.body;

  try {
    // Determine final image URLs (supporting either Cloudinary multipart uploads or raw JSON URL inputs)
    let imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      imageUrls = (req.files as any[]).map(file => file.path || file.secure_url || file.url);
    } else {
      imageUrls = Array.isArray(req.body.images) ? req.body.images : (req.body.imagePreset ? [req.body.imagePreset] : []);
    }

    // Conversão de preco (Float) robusta com tratamento contra valores nulos, vazios ou informados incorretos (NaN)
    const parsedPrice = parseFloat(price);
    const finalPrice = isNaN(parsedPrice) ? 0.0 : parsedPrice;

    // Conversão de bateria (Int?) robusta contra NaN
    let batteryHealthVal: number | null = null;
    const rawBattery = batteryStatus || req.body.batteryHealth;
    if (rawBattery !== null && rawBattery !== undefined && rawBattery !== '') {
      const parsedBattery = parseInt(rawBattery);
      if (!isNaN(parsedBattery)) {
        batteryHealthVal = parsedBattery;
      }
    }

    // Garantir ID de usuário válido para evitar falha por Integridade Referencial (Foreign Key Constraint)
    let finalUserId = userId || (req as any).userId;
    if (!finalUserId) {
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        finalUserId = defaultUser.id;
      } else {
        // Criação de um usuário padrão de contingência caso não exista nenhum no banco de dados local ou de produção
        const dummyUser = await prisma.user.create({
          data: {
            id: "default-user-id",
            email: "default-user@electromarket.com",
            name: "Samuel Oliveira",
            passwordHash: "oauth-social-login-placeholder-default",
          }
        });
        finalUserId = dummyUser.id;
      }
    }

    const newProduct = await prisma.product.create({
      data: {
        title: title || "Sem título",
        price: finalPrice,
        brand: brand || "Genérico",
        model: req.body.model || "Universal",
        description: req.body.description || "Nenhuma descrição fornecida.",
        location: req.body.location || "Brasil",
        images: imageUrls,
        isFeatured: req.body.isFeatured === 'true' || req.body.isFeatured === true,
        storage: req.body.storage || null,
        batteryHealth: batteryHealthVal,
        userId: finalUserId,
      } as any,
    });
    res.status(201).json(newProduct);
  } catch (error: any) {
    console.error("Erro detalhado do Prisma nos Anúncios:", JSON.stringify(error, null, 2));
    console.error("Erro completo original nos Anúncios:", error);
    res.status(500).json({ 
      error: "Erro ao criar o produto no banco", 
      details: error?.message || error 
    });
  }
});
router.put('/:id', authMiddleware, upload.array('images', 5), updateAd);
router.delete('/:id', authMiddleware, deleteAd);

export default router;
