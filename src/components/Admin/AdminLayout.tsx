import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import styled from 'styled-components';

const AdminLayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
`;

const Sidebar = styled.div`
  width: 250px;
  background-color: ${({ theme }) => theme.colors.primary};
  padding: 20px;
  color: white;
  display: flex;
  flex-direction: column;
`;

const Content = styled.div`
  flex: 1;
  padding: 20px;
  background-color: ${({ theme }) => theme.colors.background};
`;

const NavItem = styled.div<{ $active?: boolean }>`
  padding: 10px;
  margin: 5px 0;
  cursor: pointer;
  border-radius: 5px;
  background-color: ${({ $active, theme }) =>
    $active ? theme.colors.secondary : 'transparent'};
  &:hover {
    background-color: ${({ theme }) => theme.colors.secondary};
  }
`;

interface AdminLayoutProps {
  children: React.ReactNode;
}

const LogoutButton = styled.button`
  margin-top: auto;
  padding: 10px;
  background-color: ${({ theme }) => theme.colors.error};
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  &:hover {
    opacity: 0.9;
  }
`;

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { logout, isAuthenticated, isAdmin, isLoading } = useAuth();
  const currentPath = router.pathname;
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const token = localStorage.getItem('token');
    if (!token || !isAuthenticated || !isAdmin) {
      setIsAuthorized(false);
      router.push('/auth/login');
      return;
    }

    setIsAuthorized(true);
  }, [isAuthenticated, isAdmin, isLoading, router]);



  const navigationItems = [
    { title: 'Обзор', path: '/admin' },
    { title: 'Управление контентом', path: '/admin/content' },
    { title: 'Парсер', path: '/admin/parser' },
    { title: 'Настройки', path: '/admin/settings' },
  ];



  return (
    <AdminLayoutContainer>
      <Sidebar>
        <h2>Админ панель</h2>
        {navigationItems.map((item) => (
          <NavItem
            key={item.path}
            $active={currentPath === item.path}
            onClick={() => router.push(item.path)}
          >
            {item.title}
          </NavItem>
        ))}
        <LogoutButton
          onClick={() => {
            logout();
          }}
        >
          Выйти
        </LogoutButton>
      </Sidebar>
      <Content>{children}</Content>
    </AdminLayoutContainer>
  );
};

export default AdminLayout;