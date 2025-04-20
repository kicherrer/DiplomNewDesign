import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_id?: string;
  avatar_url?: string;
  views_count?: number;
  favorites_count?: number;
  watchlist_count?: number;
  created_at?: string;
  updated_at?: string;
}

export const useAuth = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      localStorage.setItem('token', data.token);
      await checkAuth();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ошибка при входе' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    router.push('/auth/login');
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Не авторизован');

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      await checkAuth(); // Обновляем данные пользователя
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Ошибка при обновлении профиля');
    }
  };

  const uploadAvatar = async (file: File): Promise<void> => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Не авторизован');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      await checkAuth();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Ошибка при загрузке аватара');
    }
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    setUser,
    login,
    logout,
    updateProfile,
    uploadAvatar,
  };
};