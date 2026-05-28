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
  params: (async (req, file) => {
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

    const newProduct = await prisma.product.create({
      data: {
        title,
        price: parseFloat(price),
        brand,
        model: req.body.model || "Universal",
        description: req.body.description || "Nenhuma descrição fornecida.",
        location: req.body.location || "Brasil",
        images: imageUrls,
        isFeatured: req.body.isFeatured === 'true' || req.body.isFeatured === true,
        storage: req.body.storage || null,
        batteryHealth: batteryStatus ? parseInt(batteryStatus) : (req.body.batteryHealth ? parseInt(req.body.batteryHealth) : null),
        userId, // Vincula o anúncio ao ID do Samuel / Usuário logado
      } as any,
    });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ error: "Erro ao criar o produto no banco" });
  }
});
router.put('/:id', authMiddleware, upload.array('images', 5), updateAd);
router.delete('/:id', authMiddleware, deleteAd);

export default router;
