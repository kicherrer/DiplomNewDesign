import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/Admin/AdminLayout';
import styled from 'styled-components';
import { useAuth } from '@/hooks/useAuth';

const ContentContainer = styled.div`
  padding: 20px;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
`;

const MediaCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease-in-out;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
`;

const MediaImage = styled.div<{ url?: string }>`
  height: 200px;
  background-image: url(${props => props.url || '/placeholder.jpg'});
  background-size: cover;
  background-position: center;
`;

const MediaInfo = styled.div`
  padding: 15px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 10px;
`;

const Button = styled.button`
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  &:hover {
    opacity: 0.9;
  }
`;

const SearchBar = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  margin-bottom: 20px;
`;

interface MediaItem {
  id: number;
  title: string;
  original_title?: string;
  type: 'MOVIE' | 'SERIES';
  description?: string;
  poster_url?: string;
  backdrop_url?: string;
  release_date?: string;
  rating: number;
  duration?: number;
  views: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  source_id?: string;
  source_type?: string;
  created_at: string;
  updated_at: string;
}

const ContentManagement = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const CACHE_DURATION = 60000; // 60 секунд кэширования
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 секунды между попытками

  useEffect(() => {
    const initializeContent = async () => {
      if (!user) {
        await router.push('/auth/login');
        return;
      }

      if (user.role !== 'ADMIN') {
        await router.push('/');
        return;
      }

      setIsAuthorized(true);
      await fetchMediaItems();
    };

    initializeContent();
  }, [user, router]);

  const fetchMediaItems = async () => {
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION && mediaItems.length > 0) {
      setIsLoading(false);
      return;
    }
    if (retryCount >= MAX_RETRIES) {
      setError('Превышено максимальное количество попыток загрузки');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Не найден токен авторизации');
      }

      const response = await fetch('/api/admin/content', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при загрузке данных');
      }

      const data = await response.json();
      setMediaItems(data);
      setLastFetchTime(Date.now());
    } catch (error) {
      console.error('Error fetching media items:', error);
      setError(error instanceof Error ? error.message : 'Ошибка при загрузке данных');
      setRetryCount(prev => prev + 1);
      setTimeout(() => fetchMediaItems(), RETRY_DELAY);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthorized) {
    return null;
  }

  const handleEdit = (id: number) => {
    router.push(`/admin/content/edit/${id}`);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Вы уверены, что хотите удалить этот контент?')) {
      try {
        const response = await fetch(`/api/admin/content/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Ошибка при удалении');
        setMediaItems(prevItems => prevItems.filter(item => item.id !== id));
      } catch (error) {
        console.error('Error deleting media item:', error);
      }
    }
  };

  const filteredItems = mediaItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <ContentContainer>
        <h1>Управление контентом</h1>
        {error && (
          <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>
        )}
        <SearchBar
          type="text"
          placeholder="Поиск по названию..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isLoading}
        />
        <Button 
          onClick={() => router.push('/admin/content/add')}
          disabled={isLoading}
        >
          Добавить контент
        </Button>
        {isLoading ? (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>Загрузка...</div>
        ) : (
          <ContentGrid>
            {filteredItems.length === 0 ? (
              <div>Контент не найден</div>
            ) : (
              filteredItems.map((item) => (
                <MediaCard key={item.id}>
                  <MediaImage url={item.poster_url} />
                  <MediaInfo>
                    <h3>{item.title}</h3>
                    {item.original_title && <p>Оригинальное название: {item.original_title}</p>}
                    <p>Тип: {item.type === 'MOVIE' ? 'Фильм' : 'Сериал'}</p>
                    <p>Статус: {item.status === 'ACTIVE' ? 'Активен' : item.status === 'INACTIVE' ? 'Неактивен' : 'Ошибка'}</p>
                    <p>Рейтинг: {item.rating.toFixed(1)}</p>
                    <p>Просмотры: {item.views}</p>
                    <ActionButtons>
                      <Button onClick={() => handleEdit(item.id)}>Редактировать</Button>
                      <Button onClick={() => handleDelete(item.id)}>Удалить</Button>
                    </ActionButtons>
                  </MediaInfo>
                </MediaCard>
              ))
            )}
          </ContentGrid>
        )}
      </ContentContainer>
    </AdminLayout>
  );
};

export default ContentManagement;