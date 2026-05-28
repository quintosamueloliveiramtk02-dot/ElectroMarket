import { Router } from 'express';
import { register, login, syncUser } from '../controllers/authController';

const router = Router();

// Endpoints de autenticação conectados às respectivas funções
router.post('/register', register);
router.post('/login', login);
router.post('/sync', syncUser);

export default router;
