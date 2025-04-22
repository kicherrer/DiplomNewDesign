import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/config/database';
import { verifyToken } from '@/utils/auth';
import { MediaParser } from '@/services/parser/mediaParser';
import { Prisma } from '@prisma/client';

// Кэш для хранения результатов запросов
const cache = new Map();
const CACHE_TTL = 60000; // 1 минута

const getCachedData = (key: string) => {
  const data = cache.get(key);
  if (data && Date.now() - data.timestamp < CACHE_TTL) {
    return data.value;
  }
  cache.delete(key);
  return null;
};

const setCachedData = (key: string, value: any) => {
  cache.set(key, { value, timestamp: Date.now() });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Добавляем заголовки для предотвращения кэширования на стороне браузера
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
    try {
      // Проверяем кэш
      const cacheKey = `parser_data_${payload.userId}`;
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        return res.status(200).json(cachedData);
      }

      let settings, status;
      const maxRetries = 5; // Увеличиваем количество попыток
      let attempt = 0;
      
      while (attempt < maxRetries) {
        try {
          // Используем более эффективную транзакцию
          [settings, status] = await Promise.all([
            prisma.$transaction(async (tx) => {
              return await tx.parserSettings.findFirst();
            }, {
              timeout: 5000,
              maxWait: 5000
            }),
            prisma.$transaction(async (tx) => {
              return await tx.parserStatus.findFirst();
            }, {
              timeout: 5000,
              maxWait: 5000
            })
          ]);
          // Сохраняем результат в кэш
          const result = { settings, status };
          setCachedData(cacheKey, result);
          break;
        } catch (dbError) {
          attempt++;
          if (attempt === maxRetries) {
            console.error('Database connection error after retries:', dbError);
            return res.status(503).json({ 
              error: 'База данных временно недоступна. Пожалуйста, попробуйте позже.',
              details: dbError instanceof Error ? dbError.message : 'Неизвестная ошибка'
            });
          }
          // Экспоненциальная задержка между попытками
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }

      if (!settings || !status) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.parserSettings.create({
              data: {
                id: 1,
                kinopoiskApiKey: '',
                omdbApiKey: '',
                updateInterval: 24,
                autoUpdate: true,
                contentTypes: ['movies', 'series']
              }
            });
            
            await tx.parserStatus.create({
              data: {
                id: 1,
                status: 'inactive',
                lastRun: undefined,
                processedItems: 0,
                errors: []
              }
            });
          }, {
            timeout: 5000,
            maxWait: 5000
          });
          
          [settings, status] = await Promise.all([
            prisma.parserSettings.findFirst(),
            prisma.parserStatus.findFirst()
          ]);
        } catch (initError) {
          console.error('Error initializing parser settings:', initError);
          return res.status(503).json({
            error: 'Ошибка при инициализации настроек парсера',
            details: initError instanceof Error ? initError.message : 'Неизвестная ошибка'
          });
        }
      }

      return res.status(200).json({
        settings,
        status
      });
    } catch (error) {
      console.error('Error fetching parser data:', error);
      if (error instanceof Prisma.PrismaClientInitializationError) {
        return res.status(503).json({ error: 'База данных недоступна' });
      }
      return res.status(500).json({ error: 'Ошибка при получении данных парсера' });
    }
  }

  if (req.method === 'POST') {
    const { action } = req.query;

    if (action === 'start') {
      try {
        const currentStatus = await prisma.parserStatus.findFirst();
        if (currentStatus?.status === 'active') {
          return res.status(400).json({ error: 'Парсер уже запущен' });
        }

        await prisma.parserStatus.upsert({
          where: { id: 1 },
          create: {
            status: 'active',
            lastRun: new Date(),
            processedItems: 0,
            errors: []
          },
          update: {
            status: 'active',
            lastRun: new Date(),
            errors: [],
            processedItems: 0
          }
        });

        // Проверяем наличие API ключей
        const kinopoiskApiKey = process.env.KINOPOISK_API_KEY;
        const omdbApiKey = process.env.OMDB_API_KEY;

        if (!kinopoiskApiKey || !omdbApiKey) {
          return res.status(500).json({ error: 'Отсутствуют необходимые API ключи' });
        }

        // Запускаем процесс парсинга асинхронно
        const mediaParser = new MediaParser(kinopoiskApiKey, omdbApiKey);
        mediaParser.start().catch(async (error) => {
          console.error('Parser error:', error);
          await prisma.parserStatus.update({
            where: { id: 1 },
            data: {
              status: 'error',
              errors: [(error as Error).message]
            }
          });
        });

        return res.status(200).json({ message: 'Парсер запущен' });
      } catch (error) {
        console.error('Error starting parser:', error);
        return res.status(500).json({ error: 'Ошибка при запуске парсера' });
      }
    }

    if (action === 'stop') {
      try {
        const currentStatus = await prisma.parserStatus.findFirst();
        if (currentStatus?.status !== 'active') {
          return res.status(400).json({ error: 'Парсер не запущен' });
        }

        await prisma.parserStatus.update({
          where: { id: 1 },
          data: {
            status: 'inactive',
            errors: []
          }
        });

        // Останавливаем процесс парсинга
        const kinopoiskApiKey = process.env.KINOPOISK_API_KEY;
        const omdbApiKey = process.env.OMDB_API_KEY;

        if (!kinopoiskApiKey || !omdbApiKey) {
          return res.status(500).json({ error: 'Отсутствуют необходимые API ключи' });
        }

        const mediaParser = new MediaParser(kinopoiskApiKey, omdbApiKey);
        await mediaParser.stop();

        return res.status(200).json({ message: 'Парсер остановлен' });
      } catch (error) {
        console.error('Error stopping parser:', error);
        return res.status(500).json({ error: 'Ошибка при остановке парсера' });
      }
    }
  }

  if (req.method === 'PUT') {
    const { settings } = req.body;

    try {
      const updatedSettings = await prisma.parserSettings.upsert({
        where: { id: 1 },
        create: {
          kinopoiskApiKey: settings.kinopoiskApiKey,
          omdbApiKey: settings.omdbApiKey,
          updateInterval: settings.updateInterval,
          autoUpdate: settings.autoUpdate,
          contentTypes: settings.contentTypes
        },
        update: {
          kinopoiskApiKey: settings.kinopoiskApiKey,
          omdbApiKey: settings.omdbApiKey,
          updateInterval: settings.updateInterval,
          autoUpdate: settings.autoUpdate,
          contentTypes: settings.contentTypes
        }
      });

      return res.status(200).json(updatedSettings);
    } catch (error) {
      console.error('Error updating parser settings:', error);
      return res.status(500).json({ error: 'Ошибка при обновлении настроек парсера' });
    }
  }

  return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}