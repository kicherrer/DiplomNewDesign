import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../config/database';
import { generateToken } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({ error: 'Email и код подтверждения обязательны' });
    }

    // Проверяем код подтверждения
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        expires_at: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!verificationCode) {
      return res.status(400).json({ error: 'Неверный код или срок действия истек' });
    }

    // Проверяем существование пользователя в коде верификации
    if (!verificationCode.user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Подтверждаем пользователя
    const user = await prisma.user.update({
      where: { email },
      data: { is_verified: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Удаляем использованный код
    await prisma.verificationCode.deleteMany({
      where: { email }
    });

    // Генерируем токен для автоматического входа
    const token = generateToken(user.id);

    res.status(200).json({
      message: 'Email подтвержден',
      token
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Ошибка при подтверждении email' });
  }
}