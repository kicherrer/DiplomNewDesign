import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/Admin/AdminLayout';
import styled from 'styled-components';
import { useAuth } from '@/hooks/useAuth';

const ParserContainer = styled.div`
  padding: 20px;
`;

const Section = styled.div`
  background: ${({ theme }) => theme.colors.card};
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
`;

const FormGroup = styled.div`
  margin-bottom: 15px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
`;

const Select = styled.select`
  width: 100%;
  padding: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
`;

const Button = styled.button`
  padding: 10px 20px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s ease;
  min-width: 150px;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const StatusIndicator = styled.div<{ status: 'ACTIVE' | 'INACTIVE' | 'ERROR' }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 10px;
  background-color: ${({ status }) =>
    status === 'ACTIVE' ? '#4CAF50' :
    status === 'INACTIVE' ? '#9E9E9E' : '#F44336'};
`;

interface ParserSettings {
  kinopoiskApiKey: string;
  omdbApiKey: string;
  updateInterval: number;
  autoUpdate: boolean;
  contentTypes: Array<'movies' | 'series'>;
  lastUpdate?: string;
  isEnabled: boolean;
}

interface ParserStatus {
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  lastRun: string | null;
  processedItems: number;
  errors: string[];
  currentOperation?: string;
  progress?: number;
}

const ParserManagement = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ParserSettings>({
    kinopoiskApiKey: '',
    omdbApiKey: '',
    updateInterval: 24,
    autoUpdate: true,
    contentTypes: [] as Array<'movies' | 'series'>,
    isEnabled: false,
    lastUpdate: undefined
  });
  const [status, setStatus] = useState<ParserStatus>({
    status: 'INACTIVE',
    lastRun: '-',
    processedItems: 0,
    errors: []
  });
  const router = useRouter();
  const { user } = useAuth();

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const loadParserSettings = useCallback(async () => {
    if (!isAuthorized || isLoading) return;
    
    try {
      const response = await fetch('/api/admin/parser', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка при загрузке настроек');
      }

      const data = await response.json();
      if (data.settings) {
        setSettings(prev => ({
          ...prev,
          ...data.settings
        }));
      }
      if (data.status) {
        setStatus(prev => ({
          ...prev,
          ...data.status
        }));
      }
    } catch (error) {
      console.error('Error loading parser settings:', error);
      showError(error instanceof Error ? error.message : 'Ошибка при загрузке настроек');
    }
  }, [isAuthorized, isLoading, showError]);

  useEffect(() => {
    if (!user && !isLoading) {
      router.push('/auth/login');
      return;
    }

    if (user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    setIsAuthorized(true);
  }, [user, router, isLoading]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const fetchStatus = async () => {
      if (isAuthorized && status.status === 'ACTIVE') {
        await loadParserSettings();
        timeoutId = setTimeout(fetchStatus, 5000);
      }
    };

    fetchStatus();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isAuthorized, status.status, loadParserSettings]);

  useEffect(() => {
    if (isAuthorized) {
      loadParserSettings();
    }
  }, [isAuthorized, loadParserSettings]);

  if (!isAuthorized) {
    return null;
  }

  const handleSettingsUpdate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      if (!settings.kinopoiskApiKey || !settings.omdbApiKey) {
        throw new Error('API ключи обязательны для заполнения');
      }

      const response = await fetch('/api/admin/parser', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка при сохранении настроек');
      }
      
      showError('Настройки успешно сохранены');
      await loadParserSettings();
    } catch (error) {
      console.error('Error updating parser settings:', error);
      showError(error instanceof Error ? error.message : 'Ошибка при сохранении настроек');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartParser = async () => {
    if (isLoading) return;
    if (!settings.kinopoiskApiKey || !settings.omdbApiKey) {
      showError('Необходимо указать API ключи перед запуском парсера');
      return;
    }
    
    setIsLoading(true);
    try {
      const action = status.status === 'ACTIVE' ? 'stop' : 'start';
      const response = await fetch(`/api/admin/parser?action=${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Ошибка при ${action === 'start' ? 'запуске' : 'остановке'} парсера`);
      }
      
      setStatus(prev => ({
        ...prev,
        status: action === 'start' ? 'ACTIVE' : 'INACTIVE',
        lastRun: action === 'start' ? new Date().toISOString() : prev.lastRun,
        errors: []
      }));

      showError(action === 'start' ? 'Парсер успешно запущен' : 'Парсер остановлен');
    } catch (error: unknown) {
      console.error('Error:', error);
      setError((error as { message?: string }).message || 'Ошибка при выполнении операции');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <ParserContainer>
        <h1>Управление парсером</h1>

        <Section>
          <h2>Статус парсера</h2>
          <div className="status-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <StatusIndicator status={status.status.toLowerCase() as 'ACTIVE' | 'INACTIVE' | 'ERROR'} />
            <span>
              {status.status === 'ACTIVE' ? 'Активен' :
               status.status === 'INACTIVE' ? 'Неактивен' : 'Ошибка'}
            </span>
          </div>
          <p>Последний запуск: {status.lastRun}</p>
          <p>Обработано элементов: {status.processedItems}</p>
          {status.errors.length > 0 && (
            <div>
              <h3>Ошибки:</h3>
              <ul>
                {status.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <Button onClick={handleStartParser} disabled={isLoading}>
            {isLoading ? 'Загрузка...' :
             status.status === 'ACTIVE' ? 'Остановить парсер' : 'Запустить парсер'}
          </Button>
        </Section>

        <Section>
          <h2>Настройки парсера</h2>
          <FormGroup>
            <Label>Kinopoisk API Key</Label>
            <Input
              type="text"
              value={settings.kinopoiskApiKey}
              onChange={(e) => setSettings(prev => ({ ...prev, kinopoiskApiKey: e.target.value }))}
            />
          </FormGroup>
          <FormGroup>
            <Label>OMDb API Key</Label>
            <Input
              type="text"
              value={settings.omdbApiKey}
              onChange={(e) => setSettings(prev => ({ ...prev, omdbApiKey: e.target.value }))}
            />
          </FormGroup>
          <FormGroup>
            <Label>Интервал обновления (часы)</Label>
            <Input
              type="number"
              value={settings.updateInterval}
              onChange={(e) => setSettings(prev => ({ ...prev, updateInterval: parseInt(e.target.value) }))}
            />
          </FormGroup>
          <FormGroup>
            <Label>
              <input
                type="checkbox"
                checked={settings.autoUpdate}
                onChange={(e) => setSettings(prev => ({ ...prev, autoUpdate: e.target.checked }))}
              />
              Автоматическое обновление
            </Label>
          </FormGroup>
          <FormGroup>
            <Label>Типы контента</Label>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={settings.contentTypes.includes('movies')}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...settings.contentTypes, 'movies'] as Array<'movies' | 'series'>
                      : settings.contentTypes.filter(t => t !== 'movies') as Array<'movies' | 'series'>;
                    setSettings(prev => ({ ...prev, contentTypes: newTypes }));
                  }}
                />
                Фильмы
              </label>
              <label style={{ marginLeft: '20px' }}>
                <input
                  type="checkbox"
                  checked={settings.contentTypes.includes('series')}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...settings.contentTypes, 'series'] as Array<'movies' | 'series'>
                      : settings.contentTypes.filter(t => t !== 'series') as Array<'movies' | 'series'>;
                    setSettings(prev => ({ ...prev, contentTypes: newTypes }));
                  }}
                />
                Сериалы
              </label>
            </div>
          </FormGroup>
          {error && (
            <div style={{ color: error.includes('успешно') ? 'green' : 'red', marginBottom: '10px' }}>
              {error}
            </div>
          )}
          <Button onClick={handleSettingsUpdate} disabled={isLoading}>
            {isLoading ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </Section>
      </ParserContainer>
    </AdminLayout>
  );
};

export default ParserManagement;