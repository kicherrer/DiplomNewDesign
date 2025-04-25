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
  const CHECK_INTERVAL = 300000; // 5 минут между проверками
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCheckAuth = () => {
    return new Promise<void>((resolve) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (!navigator.onLine) {
        resolve();
        return;
      }
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await checkAuth();
        } catch (error) {
          console.error('Ошибка при проверке авторизации:', error);
        } finally {
          resolve();
        }
      }, 300);
    });
  };

  const shouldCheckAuth = () => {
    const now = Date.now();
    if (now - lastCheckRef.current >= CHECK_INTERVAL) {
      lastCheckRef.current = now;
      return true;
    }
    return false;
  };

  const checkAuthImmediately = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await checkAuth();
  };

  const refreshToken = async () => {
    try {
      const currentToken = getToken();
      if (!currentToken) return false;

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          dispatch(logoutAction());
          dispatch(clearProfile());
          removeToken();
        }
        return false;
      }

      const data = await response.json();
      if (!data.token) return false;

      setToken(data.token);
      dispatch(loginSuccess(data.token));
      return true;
    } catch (error) {
      console.error('Ошибка обновления токена:', error);
      return false;
    }
  };

  const isAuthPage = router.pathname.startsWith('/auth/');
  const isAdminPage = router.pathname.startsWith('/admin/');

  useEffect(() => {
    const token = getToken();
    let isSubscribed = true;
    let isMounted = true;
    let authCheckTimeout: NodeJS.Timeout | null = null;
    let authCheckInterval: NodeJS.Timeout | null = null;
    const navigationController = new AbortController();
    
    const handleNavigation = async (path: string) => {
      if (!isMounted) return;
      try {
        await router.push(path, undefined, { 
          shallow: true,
          scroll: false 
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Ошибка навигации:', error);
        }
      }
    };

    const initAuth = async () => {
      if (!isSubscribed || !isMounted) return;

      if (!token || !navigator.onLine) {
        dispatch(logoutAction());
        dispatch(clearProfile());
        if (!isAuthPage && isAdminPage) {
          await handleNavigation('/auth/login');
        }
        return;
      }

      try {
        if (shouldCheckAuth()) {
          await debouncedCheckAuth();
          
          if (!isSubscribed || !isMounted) return;
          
          if (isAuthenticated && isAuthPage) {
            await handleNavigation('/');
            return;
          }
          
          if (isAdminPage && (!isAuthenticated || (user && user.role !== 'ADMIN'))) {
            await handleNavigation('/auth/login');
            return;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Ошибка инициализации авторизации:', error);
          if (!isAuthPage) {
            await handleNavigation('/auth/login');
          }
        }
      }
    };

    const scheduleNextCheck = () => {
      if (authCheckTimeout) clearTimeout(authCheckTimeout);
      if (authCheckInterval) clearInterval(authCheckInterval);
      
      if (isSubscribed && isMounted && !isAuthPage) {
        authCheckInterval = setInterval(() => {
          if (navigator.onLine) {
            initAuth().catch((error) => {
              if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Ошибка проверки авторизации:', error);
              }
            });
          }
        }, CHECK_INTERVAL);
      }
    };

    const cleanup = () => {
      isSubscribed = false;
      isMounted = false;
      navigationController.abort();
      if (authCheckTimeout) clearTimeout(authCheckTimeout);
      if (authCheckInterval) clearInterval(authCheckInterval);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };

    initAuth().finally(() => {
      if (isSubscribed && isMounted) {
        scheduleNextCheck();
      }
    });
    
    return cleanup;
  }, [router.pathname, isAuthenticated, user?.role]);

  useEffect(() => {
    let isMounted = true;
    
    const checkAndRedirect = async () => {
      const token = getToken();
      if (!token && !isAuthPage && isMounted) {
        try {
          await router.push('/auth/login', undefined, { 
            shallow: true,
            scroll: false 
          });
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Ошибка навигации:', error);
          }
        }
      }
    };

    checkAndRedirect();
    
    return () => {
      isMounted = false;
    };
  }, [isAuthPage, router]);

  const checkAuth = async () => {
    const token = getToken();
    
    if (!token) {
      dispatch(logoutAction());
      dispatch(clearProfile());
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // Увеличен таймаут до 20 секунд

    try {
      dispatch(setLoading(true));
      
      let retryCount = 3; // Увеличено количество попыток
      let lastError = null;
      let authSuccess = false;

      while (retryCount > 0 && !authSuccess) {
        try {
          const res = await fetch('/api/profile', {
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-store',
              'Pragma': 'no-cache'
            },
            credentials: 'include',
            signal: controller.signal
          });

          let userData;
          try {
            userData = await res.json();
          } catch (parseError) {
            throw new Error('Ошибка при обработке ответа сервера');
          }

          if (res.ok && userData) {
            dispatch(loginSuccess(token));
            dispatch(setProfile(userData));
            authSuccess = true;
            return true;
          }

          if (res.status === 401) {
            const isRefreshed = await refreshToken();
            if (!isRefreshed) {
              if (retryCount === 1) { // Изменено условие
                throw new Error('Не удалось обновить токен');
              }
              retryCount--;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Увеличен интервал
              continue;
            }

            const newToken = getToken();
            if (!newToken) {
              throw new Error('Токен отсутствует после обновления');
            }

            const retryRes = await fetch('/api/profile', {
              headers: {
                Authorization: `Bearer ${newToken}`,
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
              },
              credentials: 'include',
              signal: controller.signal
            });

            if (retryRes.ok) {
              try {
                const retryData = await retryRes.json();
                dispatch(loginSuccess(newToken));
                dispatch(setProfile(retryData));
                authSuccess = true;
                return true;
              } catch (parseError) {
                throw new Error('Ошибка при обработке ответа сервера после обновления токена');
              }
            }

            if (retryCount === 1) {
              throw new Error('Не удалось авторизоваться после обновления токена');
            }
          }

          retryCount--;
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (fetchError) {
          lastError = fetchError;
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error('Превышено время ожидания запроса');
          }
          if (retryCount === 1) {
            throw fetchError;
          }
          retryCount--;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      throw lastError || new Error('Не удалось выполнить запрос после всех попыток');
    } catch (error) {
      console.error('Ошибка при проверке авторизации:', error);
      if (!navigator.onLine) {
        console.warn('Отсутствует подключение к интернету');
        return false;
      }
      dispatch(logoutAction());
      dispatch(clearProfile());
      removeToken();
      return false;
    } finally {
      clearTimeout(timeoutId);
      controller.abort();
      dispatch(setLoading(false));
    }
  };

  const login = async (email: string, password: string) => {
    if (!navigator.onLine) {
      const errorMessage = 'Нет подключения к интернету';
      dispatch(loginFailure(errorMessage));
      return { success: false, error: errorMessage };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Увеличен таймаут до 30 секунд

    try {
      dispatch(loginStart());
      dispatch(setLoading(true));

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
        credentials: 'include'
      });

      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        throw new Error('Ошибка при обработке ответа сервера');
      }

      if (!res.ok) {
        let errorMessage = 'Ошибка авторизации';
        if (res.status === 401) {
          errorMessage = data?.error || 'Неверные учетные данные';
        } else if (res.status === 500) {
          errorMessage = 'Ошибка сервера, попробуйте позже';
        }
        throw new Error(errorMessage);
      }

      if (!data?.token) {
        throw new Error('Токен не получен от сервера');
      }

      setToken(data.token);
      dispatch(loginSuccess(data.token));
      
      let retryCount = 3;
      let lastError = null;
      let authSuccess = false;

      while (retryCount > 0 && !authSuccess) {
        try {
          await checkAuthImmediately();
          const currentToken = getToken();
          
          if (!currentToken) {
            throw new Error('Токен отсутствует после проверки');
          }

          const profileResponse = await fetch('/api/profile', {
            headers: {
              'Authorization': `Bearer ${currentToken}`,
              'Cache-Control': 'no-store'
            },
            credentials: 'include'
          });

          if (profileResponse.ok) {
            const userData = await profileResponse.json();
            dispatch(setProfile(userData));
            authSuccess = true;
            await router.push('/', undefined, { 
              shallow: true, 
              scroll: false 
            });
            return { success: true };
          } else {
            throw new Error('Ошибка получения профиля');
          }
        } catch (authError) {
          lastError = authError;
          retryCount--;
          if (retryCount === 0) {
            removeToken();
            dispatch(logoutAction());
            dispatch(clearProfile());
            throw new Error('Не удалось подтвердить авторизацию');
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!authSuccess) {
        throw lastError || new Error('Не удалось выполнить вход');
      }

      return { success: true };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          const errorMessage = 'Превышено время ожидания запроса';
          dispatch(loginFailure(errorMessage));
          return { success: false, error: errorMessage };
        }
        dispatch(loginFailure(error.message));
        return { success: false, error: error.message };
      }
      const errorMessage = 'Ошибка при входе';
      dispatch(loginFailure(errorMessage));
      return { success: false, error: errorMessage };
    } finally {
      clearTimeout(timeoutId);
      controller.abort();
      dispatch(setLoading(false));
    }
  };

  const logout = () => {
    removeToken();
    dispatch(logoutAction());
    dispatch(clearProfile());
    router.push('/auth/login', undefined, { 
      shallow: true,
      scroll: false 
    }).catch((error) => {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Ошибка навигации при выходе:', error);
      }
    });
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