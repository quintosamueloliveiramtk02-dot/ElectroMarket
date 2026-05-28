import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { createAd, getAllAds, getAdById, updateAd, deleteAd } from '../controllers/adController';
import { authMiddleware } from '../middlewares/authMiddleware';

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
router.post('/', authMiddleware, upload.array('images', 5), createAd);
router.put('/:id', authMiddleware, upload.array('images', 5), updateAd);
router.delete('/:id', authMiddleware, deleteAd);

export default router;
