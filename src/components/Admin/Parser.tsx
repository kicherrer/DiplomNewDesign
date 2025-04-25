import React, { useState, useEffect } from 'react';
import { Box, Button, Tab, Tabs, Typography, Paper, CircularProgress, List, ListItem, ListItemText } from '@mui/material';
import { styled } from '@mui/material/styles';

const ParserContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  '& .MuiPaper-root': {
    marginTop: theme.spacing(2)
  }
}));

const LogItem = styled(ListItem)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-child': {
    borderBottom: 'none'
  }
}));

interface ParserLog {
  id: number;
  message: string;
  error: string;
  timestamp: string;
}

interface ParserStatus {
  status: 'active' | 'inactive' | 'error';
  lastRun?: Date;
  processedItems: number;
  errors: string[];
}

interface ParserSettings {
  kinopoiskApiKey: string;
  omdbApiKey: string;
  updateInterval: number;
  autoUpdate: boolean;
  contentTypes: string[];
}

export default function Parser() {
  const [activeTab, setActiveTab] = useState(0);
  const [status, setStatus] = useState<ParserStatus | null>(null);
  const [settings, setSettings] = useState<ParserSettings | null>(null);
  const [logs, setLogs] = useState<ParserLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/parser', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(data.status);
      setSettings(data.settings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных парсера');
    }
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/parser/logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLogs(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const startParser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/parser?action=start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kinopoiskApiKey: settings?.kinopoiskApiKey,
          omdbApiKey: settings?.omdbApiKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await fetchParserData();
      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при запуске парсера');
    }
  };

  const stopParser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/parser?action=stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await fetchParserData();
      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при остановке парсера');
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    
    const loadData = async () => {
      if (!isSubscribed) return;
      setLoading(true);
      try {
        await Promise.all([fetchParserData(), fetchLogs()]);
      } catch (error) {
        console.error('Error loading data:', error);
      }
      if (isSubscribed) {
        setLoading(false);
      }
    };
    
    loadData();

    const interval = setInterval(() => {
      if (status?.status === 'active' && isSubscribed) {
        Promise.all([fetchParserData(), fetchLogs()])
          .catch(error => console.error('Error updating data:', error));
      }
    }, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [status?.status]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ParserContainer>
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>Парсер контента</Typography>
        {error && (
          <Typography color="error" gutterBottom>{error}</Typography>
        )}
      </Box>

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
        <Tab label="Статус" />
        <Tab label="Логи" />
      </Tabs>

      {activeTab === 0 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Текущий статус</Typography>
          <Box my={2}>
            <Typography>
              Статус: {status?.status === 'active' ? 'Активен' : status?.status === 'error' ? 'Ошибка' : 'Неактивен'}
            </Typography>
            {status?.lastRun && (
              <Typography>
                Последний запуск: {new Date(status.lastRun).toLocaleString()}
              </Typography>
            )}
            <Typography>
              Обработано элементов: {status?.processedItems || 0}
            </Typography>
          </Box>
          <Box mt={3}>
            <Button
              variant="contained"
              color="primary"
              onClick={startParser}
              disabled={status?.status === 'active'}
              sx={{ mr: 2 }}
            >
              Запустить парсер
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={stopParser}
              disabled={status?.status !== 'active'}
            >
              Остановить парсер
            </Button>
          </Box>
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper elevation={2}>
          <List>
            {logs.map((log) => (
              <LogItem key={log.id}>
                <ListItemText
                  primary={log.message}
                  secondary={`${new Date(log.timestamp).toLocaleString()}${log.error ? ` - Ошибка: ${log.error}` : ''}`}
                  sx={{
                    '& .MuiListItemText-primary': {
                      color: log.error ? 'error.main' : 'text.primary'
                    }
                  }}
                />
              </LogItem>
            ))}
          </List>
        </Paper>
      )}
    </ParserContainer>
  );
}