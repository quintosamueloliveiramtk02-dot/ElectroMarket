import { Router } from 'express';
import { createAd, getAllAds, getAdById, updateAd, deleteAd } from '../controllers/adController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Rotas públicas de consulta
router.get('/', getAllAds);
router.get('/:id', getAdById);

// Rotas privadas protegidas pelo authMiddleware
router.post('/', authMiddleware, createAd);
router.put('/:id', authMiddleware, updateAd);
router.delete('/:id', authMiddleware, deleteAd);

export default router;
