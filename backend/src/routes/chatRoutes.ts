import { Router } from 'express';
import { getOrCreateChat, getUserChats, getChatMessages } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Todas as rotas de chat requerem que o usuário esteja devidamente autenticado
router.post('/', authMiddleware, getOrCreateChat);
router.get('/', authMiddleware, getUserChats);
router.get('/:id/messages', authMiddleware, getChatMessages);

export default router;
