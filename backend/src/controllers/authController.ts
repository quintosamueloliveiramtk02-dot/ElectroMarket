import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-electromarket';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone, avatarUrl } = req.body;

    // Campos obrigatórios de validação
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Campos obrigatórios ausentes (email, password, name)' });
      return;
    }

    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'Este e-mail já está cadastrado em nossa plataforma' });
      return;
    }

    // Criptografar a senha com o Bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Salvar o novo usuário no PostgreSQL via Prisma
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        avatarUrl,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
      }
    });

    // Gerar um Token JWT válido por 7 dias
    const token = jwt.sign({ id: user.id }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      message: 'Usuário registrado com sucesso!',
      user,
      token,
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Erro interno do servidor ao registrar usuário', 
      details: error.message 
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validar entradas
    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
      return;
    }

    // Verificar se o e-mail existe cadastrado
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: 'E-mail ou senha incorretos' });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: 'E-mail ou senha incorretos' });
      return;
    }

    // Comparar senhas com Bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash || '');

    if (!isPasswordValid) {
      res.status(401).json({ error: 'E-mail ou senha incorretos' });
      return;
    }

    // Gerar Token JWT válido por 7 dias
    const token = jwt.sign({ id: user.id }, JWT_SECRET, {
      expiresIn: '7d',
    });

    // Resposta de sucesso omitindo a hash de senha
    res.status(200).json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Erro interno do servidor ao realizar login', 
      details: error.message 
    });
  }
};

export const syncUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, email, name, avatarUrl, phone } = req.body;

    // Fallbacks robustos para evitar rejeição do PostgreSQL por restrições de NOT NULL ou UNIQUE
    const fallbackId = id || `user-${Date.now()}`;
    const fallbackEmail = email || `user-${fallbackId}@example.com`;
    const fallbackName = name || "Usuário";

    // 1. Tentar encontrar usuário pelo id ou pelo email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: fallbackId },
          { email: fallbackEmail }
        ]
      }
    });

    if (user) {
      // Se o usuário existe mas com id diferente (ex: cadastro prévio por email tradicional),
      // atualizamos as informações cruciais mas mantemos seu id atual para integridade referencial.
      if (user.id !== fallbackId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: fallbackName || user.name || "Usuário",
            avatarUrl: avatarUrl || user.avatarUrl,
            phone: phone || user.phone,
          }
        });
      } else {
        // IDs idênticos, atualiza as informações normais
        user = await prisma.user.update({
          where: { id: fallbackId },
          data: {
            email: fallbackEmail,
            name: fallbackName || user.name || "Usuário",
            avatarUrl: avatarUrl || user.avatarUrl,
            phone: phone || user.phone,
          }
        });
      }
    } else {
      // Cria um novo usuário se não existir nem por id nem por email
      user = await prisma.user.create({
        data: {
          id: fallbackId,
          email: fallbackEmail,
          name: fallbackName,
          avatarUrl: avatarUrl || null,
          phone: phone || null,
        }
      });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(200).json({
      message: 'Usuário sincronizado com sucesso!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error: any) {
    console.error("Erro detalhado do Prisma:", JSON.stringify(error, null, 2));
    console.error("Erro completo original:", error);
    res.status(500).json({
      error: 'Erro interno ao sincronizar usuário',
      details: error.message
    });
  }
};
