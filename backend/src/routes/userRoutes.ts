import { Router } from 'express';
import multer from 'multer';
import { getMyProducts, updateProfile, uploadAvatar } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';

const upload = multer();
const router = Router();

// Endpoint seguro para retornar os anúncios do usuário autenticado
router.get('/me/products', authMiddleware, getMyProducts);

// Endpoint seguro para upload de arquivo de imagem de perfil do usuário para o Cloudinary
router.post('/upload', authMiddleware, upload.single('file'), uploadAvatar);

// Endpoint seguro para atualizar o avatarUrl do usuário na tabela User do PostgreSQL
router.put('/me', authMiddleware, updateProfile);

export default router;
