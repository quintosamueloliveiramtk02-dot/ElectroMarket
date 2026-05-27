import { Router } from 'express';
import { register, login } from '../controllers/authController';

const router = Router();

// Endpoints de autenticação conectados às respectivas funções
router.post('/register', register);
router.post('/login', login);

export default router;
