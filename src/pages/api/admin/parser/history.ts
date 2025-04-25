import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/config/database';
import { verifyToken } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token);

    if (!payload || typeof payload.userId !== 'number') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    // Проверка прав администратора
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    if (req.method === 'GET') {
      const parserHistory = await prisma.parserHistory.findMany({
        orderBy: {
          startTime: 'desc'
        },
        take: 50,
        select: {
          id: true,
          status: true,
          startTime: true,
          endTime: true,
          itemsProcessed: true,
          source: true,
          details: true,
          errors: true
        }
      });

      return res.status(200).json(parserHistory);
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (error) {
    console.error('Error in parser history endpoint:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}