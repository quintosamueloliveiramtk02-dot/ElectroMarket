import { Router } from 'express';
import { getMyProducts } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Endpoint seguro para retornar os anúncios do usuário autenticado
router.get('/me/products', authMiddleware, getMyProducts);

export default router;
