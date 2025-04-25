import axios from 'axios';
import { prisma } from '@/config/database';
import { MediaStatus } from '@prisma/client';

interface VideoSource {
  url: string;
  quality: string;
  type: 'movie' | 'trailer';
}

export class VideoProcessor {
  private readonly TRAILER_API_URL = 'https://kinopoiskapiunofficial.tech/api/v2.2/films';
  private readonly kinopoiskApiKey: string;

  constructor(kinopoiskApiKey: string) {
    this.kinopoiskApiKey = kinopoiskApiKey;
  }

  async processMediaVideo(mediaId: number, sourceId: string): Promise<void> {
    try {
      const media = await prisma.media.findUnique({
        where: { id: mediaId }
      });

      if (!media) {
        throw new Error('Медиа не найдено');
      }

      // Проверяем дату релиза
      const isReleased = media.release_date && new Date(media.release_date) <= new Date();

      if (!isReleased) {
        // Если контент еще не вышел, получаем трейлер
        await this.processTrailer(mediaId, sourceId);
        return;
      }

      // Пытаемся получить видео
      const videoSources = await this.getVideoSources(sourceId);
      
      if (videoSources.length === 0) {
        // Если видео не найдено, пробуем получить трейлер
        await this.processTrailer(mediaId, sourceId);
        return;
      }

      // Сохраняем источники видео
      await this.saveVideoSources(mediaId, videoSources);

    } catch (error) {
      console.error('Error processing media video:', error);
      await this.updateMediaStatus(mediaId, MediaStatus.ERROR);
      throw error;
    }
  }

  private async processTrailer(mediaId: number, sourceId: string): Promise<void> {
    try {
      const trailerUrl = await this.getTrailerUrl(sourceId);
      if (trailerUrl) {
        await prisma.videoSource.create({
          data: {
            media_id: mediaId,
            url: trailerUrl,
            quality: 'HD',
            type: 'trailer'
          }
        });
      }
    } catch (error) {
      console.error('Error processing trailer:', error);
      throw error;
    }
  }

  private async getTrailerUrl(sourceId: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.TRAILER_API_URL}/${sourceId}/videos`,
        {
          headers: {
            'X-API-KEY': this.kinopoiskApiKey,
            'Content-Type': 'application/json',
          }
        }
      );

      const trailers = response.data.items?.filter((item: any) => 
        item.site === 'YOUTUBE' && item.type === 'TRAILER'
      );

      return trailers?.[0]?.url || null;
    } catch (error) {
      console.error('Error fetching trailer:', error);
      return null;
    }
  }

  private async getVideoSources(sourceId: string): Promise<VideoSource[]> {
    try {
      // Попытка получить видео из разных источников
      const sources: VideoSource[] = [];
      
      // Интеграция с VK Video
      try {
        const vkSources = await this.getVKVideoSources(sourceId);
        sources.push(...vkSources);
      } catch (error) {
        console.error('Error getting VK video sources:', error);
      }

      // Интеграция с RuTube
      try {
        const ruTubeSources = await this.getRuTubeVideoSources(sourceId);
        sources.push(...ruTubeSources);
      } catch (error) {
        console.error('Error getting RuTube video sources:', error);
      }

      // Интеграция с YouTube (для трейлеров и обзоров)
      try {
        const youtubeSources = await this.getYouTubeVideoSources(sourceId);
        sources.push(...youtubeSources);
      } catch (error) {
        console.error('Error getting YouTube video sources:', error);
      }

      return sources;
    } catch (error) {
      console.error('Error getting video sources:', error);
      return [];
    }
  }

  private async getVKVideoSources(sourceId: string): Promise<VideoSource[]> {
    // Реализация получения видео из VK Video API
    return [];
  }

  private async getRuTubeVideoSources(sourceId: string): Promise<VideoSource[]> {
    // Реализация получения видео из RuTube API
    return [];
  }

  private async getYouTubeVideoSources(sourceId: string): Promise<VideoSource[]> {
    // Реализация получения видео из YouTube API
    return [];
  }

  private async saveVideoSources(mediaId: number, sources: VideoSource[]): Promise<void> {
    await prisma.videoSource.createMany({
      data: sources.map(source => ({
        media_id: mediaId,
        url: source.url,
        quality: source.quality,
        type: source.type
      }))
    });
  }

  private async updateMediaStatus(mediaId: number, status: MediaStatus): Promise<void> {
    await prisma.media.update({
      where: { id: mediaId },
      data: { status }
    });
  }
}