import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../config/database';
import { verifyToken } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверяем токен
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];
  const payload = await verifyToken(token);

  if (!payload || typeof payload.userId !== 'number') {
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  try {
    // Проверяем, является ли текущий пользователь администратором
    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true }
    });

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const { email, role } = req.body;

    if (!email || !role || !['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }

    // Обновляем роль пользователя
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role },
      select: { email: true, role: true }
    });

    res.status(200).json({
      message: 'Роль пользователя обновлена',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Ошибка при обновлении роли пользователя' });
  }
}