import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import Layout from '../../components/Layout/Layout';
import { motion } from 'framer-motion';

interface Movie {
  id: number;
  title: string;
  original_title?: string;
  description: string;
  poster_url?: string;
  poster_path?: string;
  backdrop_url?: string;
  release_date: string;
  rating: number;
  duration?: number;
  views: number;
  director?: string;
  actors: Array<{
    name: string;
    role?: string;
    photo_url?: string;
    character?: string;
    biography?: string;
  }>;
  writers: Array<{
    name: string;
    role?: string;
    biography?: string;
  }>;
  crew?: {
    director: {
      name: string;
      photo_url?: string;
      biography?: string;
    };
    producers?: Array<{
      name: string;
      role?: string;
      biography?: string;
    }>;
  };
  genres: string[];
  video_source?: string;
  trailer_url?: string;
}

const WatchContainer = styled.div`
  padding: 0;
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
`;

const ContentWrapper = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.xl};
  position: relative;
`;

const Poster = styled.img`
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
`;

const BackdropImage = styled.div<{ $url?: string }>`
  width: 100%;
  height: 600px;
  background: ${({ $url, theme }) => $url ? `linear-gradient(to bottom, transparent 60%, ${theme.colors.background}), url(${$url})` : theme.colors.surface};
  background-size: cover;
  background-position: center;
  position: relative;
`;

const InfoSection = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  margin-top: -100px;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    margin-top: 0;
  }
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize['3xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const MetaInfo = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Description = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  line-height: 1.6;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const GenreList = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const Genre = styled.span`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const SubTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const CrewSection = styled.div`
  margin: ${({ theme }) => theme.spacing.xl} 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const ActorsList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-top: ${({ theme }) => theme.spacing.md};
`;

const ActorCard = styled.div`
  text-align: center;
`;

const ActorImage = styled.img`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const ActorName = styled.div`
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const ActorRole = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const VideoPlayer = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xl};
  width: 100%;
  aspect-ratio: 16/9;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  position: relative;

  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .video-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: ${({ theme }) => theme.spacing.md};
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const CrewItem = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: baseline;
`;

const CrewLabel = styled.span`
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  min-width: 120px;
`;

const CrewValue = styled.span`
  color: ${({ theme }) => theme.colors.text};
  flex: 1;
`;

const ErrorContainer = styled(motion.div)`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
`;

const ErrorTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize['4xl']};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.error};
`;

const ErrorMessage = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const BackButton = styled(motion.button)`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryDark};
  }
`;

const WatchPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<Movie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovie = async () => {
      if (!id) return;

      try {
        const response = await fetch(`/api/movies/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Медиа контент не найден');
          }
          throw new Error('Ошибка при загрузке медиа контента');
        }

        const data = await response.json();
        setMovie(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Произошла ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <WatchContainer>
          <div>Загрузка...</div>
        </WatchContainer>
      </Layout>
    );
  }

  if (error || !movie) {
    return (
      <Layout>
        <ErrorContainer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <ErrorTitle>404</ErrorTitle>
          <ErrorMessage>{error || 'Медиа контент не найден'}</ErrorMessage>
          <BackButton
            onClick={() => router.push('/catalog')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Вернуться в каталог
          </BackButton>
        </ErrorContainer>
      </Layout>
    );
  }

  return (
    <Layout>
      <WatchContainer>
        <BackdropImage $url={movie.backdrop_url} />
        <ContentWrapper>
          <InfoSection>
            <div>
              <Poster
                src={movie.poster_url || movie.poster_path}
                alt={movie.title}
                onError={(e) => {
                  console.error(`Failed to load poster for movie: ${movie.title}`);
                  e.currentTarget.src = '/default-poster.jpg';
                }}
              />
            </div>
            <div>
              <Title>{movie.title}</Title>
              {movie.original_title && (
                <div style={{ marginBottom: '1rem', color: 'gray' }}>
                  {movie.original_title}
                </div>
              )}
              <MetaInfo>
                <span>{new Date(movie.release_date).getFullYear()}</span>
                <span style={{ color: '#f5c518' }}>★ {movie.rating.toFixed(1)}</span>
                {movie.duration && <span>{Math.floor(movie.duration / 60)}ч {movie.duration % 60}м</span>}
                <span>👁 {movie.views.toLocaleString()}</span>
              </MetaInfo>
              <Description>{movie.description}</Description>
              <GenreList>
                {movie.genres.map((genre) => (
                  <Genre key={genre}>{genre}</Genre>
                ))}
              </GenreList>

              {(movie.video_source || movie.trailer_url) && (
                <VideoPlayer>
                  {movie.video_source ? (
                    <video
                      src={movie.video_source}
                      controls
                      playsInline
                      poster={movie.backdrop_url || movie.poster_url}
                    >
                      Ваш браузер не поддерживает видео
                    </video>
                  ) : movie.trailer_url ? (
                    <iframe
                      src={movie.trailer_url}
                      title={`Трейлер ${movie.title}`}
                      allowFullScreen
                    />
                  ) : null}
                </VideoPlayer>
              )}

              <CrewSection>
                <SubTitle>Создатели</SubTitle>
                {movie.crew?.director && (
                  <CrewItem>
                    <CrewLabel>Режиссер:</CrewLabel>
                    <CrewValue>{movie.crew.director.name}</CrewValue>
                  </CrewItem>
                )}
                {movie.writers && movie.writers.length > 0 && (
                  <CrewItem>
                    <CrewLabel>Сценаристы:</CrewLabel>
                    <CrewValue>
                      {movie.writers.map(writer => writer.name).join(', ')}
                    </CrewValue>
                  </CrewItem>
                )}
              </CrewSection>

              {movie.actors && movie.actors.length > 0 && (
                <CrewSection>
                  <SubTitle>В главных ролях</SubTitle>
                  <ActorsList>
                    {movie.actors.map((actor, index) => (
                      <ActorCard key={index}>
                        <ActorImage
                          src={actor.photo_url || '/default-actor.jpg'}
                          alt={actor.name}
                        />
                        <ActorName>{actor.name}</ActorName>
                        {actor.role && <ActorRole>{actor.role}</ActorRole>}
                      </ActorCard>
                    ))}
                  </ActorsList>
                </CrewSection>
              )}
            </div>
          </InfoSection>
        </ContentWrapper>
      </WatchContainer>
    </Layout>
  );
};

export default WatchPage;