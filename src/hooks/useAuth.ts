import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { loginStart, loginSuccess, loginFailure, logout as logoutAction } from '../store/slices/authSlice';
import { setProfile, clearProfile, setLoading, setError } from '../store/slices/userSlice';
import { RootState } from '../store';

const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

const setToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
};

const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
};

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
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
  const currentPath = router.pathname;
  const dispatch = useDispatch();
  const { isAuthenticated, loading: authLoading, error: authError } = useSelector((state: RootState) => state.auth);
  const { profile: user, loading: userLoading, error: userError } = useSelector((state: RootState) => state.user);
  const isLoading = authLoading || userLoading;
  const lastCheckRef = useRef<number>(0);
  const CHECK_INTERVAL = 5000; // Минимальный интервал между проверками (5 секунд)

  const shouldCheckAuth = () => {
    const now = Date.now();
    if (now - lastCheckRef.current >= CHECK_INTERVAL) {
      lastCheckRef.current = now;
      return true;
    }
    return false;
  };

  const isAuthPage = router.pathname.startsWith('/auth/');
  const isAdminPage = router.pathname.startsWith('/admin/');

  useEffect(() => {
    const token = getToken();
    let isSubscribed = true;
    let isMounted = true;
    
    const initAuth = async () => {
      if (!token) {
        dispatch(logoutAction());
        dispatch(clearProfile());
        if (isMounted && !isAuthPage && (isAdminPage || currentPath !== '/')) {
          router.push('/auth/login').catch(console.error);
        }
        return;
      }

      try {
        if (isSubscribed && isMounted && shouldCheckAuth()) {
          await checkAuth();
          if (isAuthPage && isAuthenticated && isMounted) {
            router.push('/').catch(console.error);
          } else if (isAdminPage && (!isAuthenticated || (user && user.role !== 'ADMIN')) && isMounted) {
            router.push('/auth/login').catch(console.error);
          }
        }
      } catch (error) {
        console.error('Ошибка инициализации авторизации:', error);
        if (!isAuthPage && isSubscribed && isMounted) {
          router.push('/auth/login').catch(console.error);
        }
      }
    };

    const authCheckInterval = setInterval(() => {
      if (isSubscribed && isMounted && !isAuthPage) {
        initAuth();
      }
    }, CHECK_INTERVAL);

    initAuth();
    
    return () => {
      isSubscribed = false;
      isMounted = false;
      clearInterval(authCheckInterval);
    };
  }, [router.pathname, isAuthenticated, user?.role]);

  useEffect(() => {
    const token = getToken();
    if (!token && !isAuthPage) {
      router.push('/auth/login').catch(console.error);
    }
  }, [isAuthPage]);

  const checkAuth = async () => {
    dispatch(setLoading(true));
    const token = getToken();
    
    if (!token) {
      dispatch(logoutAction());
      dispatch(clearProfile());
      dispatch(setLoading(false));
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
        dispatch(loginSuccess(token));
        dispatch(setProfile(userData));
      } else {
        dispatch(logoutAction());
        dispatch(clearProfile());
        removeToken();
      }
    } catch (error) {
      console.error('Ошибка при проверке авторизации:', error);
      dispatch(logoutAction());
      dispatch(clearProfile());
      removeToken();
    }
  };

  const login = async (email: string, password: string) => {
    try {
      dispatch(loginStart());
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setToken(data.token);
      dispatch(loginSuccess(data.token));
      await checkAuth();
      router.push('/');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при входе';
      dispatch(loginFailure(errorMessage));
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    removeToken();
    dispatch(logoutAction());
    dispatch(clearProfile());
    router.push('/auth/login');
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    const token = getToken();
    if (!token) throw new Error('Не авторизован');

    try {
      dispatch(setLoading(true));
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

      await checkAuth();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при обновлении профиля';
      dispatch(setError(errorMessage));
      throw new Error(errorMessage);
    }
  };

  const uploadAvatar = async (file: File): Promise<void> => {
    const token = getToken();
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
    login,
    logout,
    updateProfile,
    uploadAvatar,
    token: getToken(),
    isAdmin: user?.role === 'ADMIN',
    error: authError || userError
  };
};