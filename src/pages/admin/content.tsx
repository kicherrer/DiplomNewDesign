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

interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

const ContentManagement = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [activeRequest, setActiveRequest] = useState<AbortController | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 10, // Уменьшаем количество элементов на странице
    total: 0
  });
  const CACHE_DURATION = 300000; // Увеличиваем кэширование до 5 минут
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000; // Увеличиваем задержку между попытками до 5 секунд
  const DEBOUNCE_DELAY = 500; // Увеличиваем задержку для поиска

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
    };

    initializeContent();
  }, [user, router]);

  useEffect(() => {
    if (isAuthorized && !isLoading) {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchMediaItems();
    }
  }, [isAuthorized]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (Array.isArray(mediaItems)) {
        const searchLower = searchQuery.toLowerCase().trim();
        const filtered = mediaItems.filter((item: MediaItem) => {
          if (!item) return false;
          const titleMatch = item.title ? item.title.toLowerCase().includes(searchLower) : false;
          const originalTitleMatch = item.original_title ? item.original_title.toLowerCase().includes(searchLower) : false;
          return titleMatch || originalTitleMatch;
        });
        setFilteredItems(filtered);
      } else {
        setFilteredItems([]);
      }
    }, DEBOUNCE_DELAY);

    return () => {
      clearTimeout(debounceTimer);
      if (activeRequest) {
        activeRequest.abort();
      }
    };
  }, [searchQuery, mediaItems]);

  useEffect(() => {
    if (isAuthorized && !isLoading) {
      const debounceTimer = setTimeout(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchMediaItems();
      }, DEBOUNCE_DELAY);
      
      return () => clearTimeout(debounceTimer);
    }
  }, [searchQuery, isAuthorized]);


  const loadMore = () => {
    if (!isLoading && mediaItems.length < pagination.total) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
      fetchMediaItems();
    }
  };

  const fetchMediaItems = async () => {
    const now = Date.now();
    
    try {
      // Проверка кэша и валидности данных
      if (now - lastFetchTime < CACHE_DURATION && mediaItems.length > 0 && !searchQuery.trim()) {
        setIsLoading(false);
        return;
      }

      // Проверка количества попыток
      if (retryCount >= MAX_RETRIES) {
        throw new Error('Превышено максимальное количество попыток загрузки');
      }

      // Отмена предыдущего запроса
      if (activeRequest) {
        activeRequest.abort();
      }

      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      setActiveRequest(controller);
      
      // Установка таймаута для запроса
      const timeoutId = setTimeout(() => {
        controller.abort();
        setError('Превышено время ожидания запроса');
        setIsLoading(false);
      }, 15000);

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Не найден токен авторизации');
        }

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchQuery
      });

      const response = await fetch(`/api/admin/content?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        if (response.status === 429) {
          throw new Error('Слишком много запросов, попробуйте позже');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при загрузке данных');
      }

      const data = await response.json();
      
      // Валидация структуры данных
      if (!data || typeof data !== 'object') {
        throw new Error('Некорректный формат данных от сервера');
      }

      const { items = [], total = 0 } = data;

      if (!Array.isArray(items) || typeof total !== 'number') {
        console.error('Некорректный формат данных:', { items, total });
        throw new Error('Некорректный формат данных от сервера');
      }

      // Оптимизированная валидация элементов
      const validatedItems = items.reduce((acc: MediaItem[], item, index) => {
        if (!item || typeof item !== 'object') {
          console.error(`Некорректный формат элемента ${index}:`, item);
          return acc;
        }

        const requiredFields = {
          id: typeof item.id === 'number',
          title: typeof item.title === 'string',
          type: ['MOVIE', 'SERIES'].includes(item.type),
          rating: typeof item.rating === 'number',
          views: typeof item.views === 'number',
          status: ['ACTIVE', 'INACTIVE', 'ERROR'].includes(item.status)
        };

        const isValid = Object.values(requiredFields).every(Boolean);

        if (!isValid) {
          console.error(`Элемент ${index} не прошел валидацию:`, requiredFields);
          return acc;
        }

        acc.push(item as MediaItem);
        return acc;
      }, []);

      // Оптимизированное обновление состояния
      const newItems = pagination.page === 1 ? validatedItems : [...mediaItems, ...validatedItems];
      const searchLower = searchQuery.toLowerCase().trim();
      
      const filtered = searchLower ? newItems.filter(item => {
        return item.title.toLowerCase().includes(searchLower) ||
          (item.original_title?.toLowerCase().includes(searchLower) ?? false);
      }) : newItems;

      setMediaItems(newItems);
      setFilteredItems(filtered);
      setPagination(prev => ({ ...prev, total }));
      setLastFetchTime(now);
      setRetryCount(0);
      setIsLoading(false);

      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            setError('Превышено время ожидания запроса');
          } else {
            console.error('Error fetching media items:', error);
            setError(error.message);
            
            // Экспоненциальная задержка для повторных попыток
            if (retryCount < MAX_RETRIES) {
              const delay = RETRY_DELAY * Math.pow(2, retryCount);
              setRetryCount(prev => prev + 1);
              setTimeout(() => fetchMediaItems(), delay);
            }
          }
        }
      } finally {
        setIsLoading(false);
        setActiveRequest(null);
      }
    } catch (outerError) {
      setError('Произошла непредвиденная ошибка');
      setIsLoading(false);
      console.error('Outer error:', outerError);
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
          <>
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
            {filteredItems.length < pagination.total && (
              <Button 
                onClick={loadMore} 
                disabled={isLoading}
                style={{ margin: '20px auto', display: 'block' }}
              >
                {isLoading ? 'Загрузка...' : 'Загрузить еще'}
              </Button>
            )}
          </>
        )}
      </ContentContainer>
    </AdminLayout>
  );
};

export default ContentManagement;