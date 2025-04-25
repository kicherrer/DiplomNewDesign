import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiEdit2, FiTrash2, FiImage, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const HistoryContainer = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
`;

const HistoryTitle = styled.h2`
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  color: ${({ theme }) => theme.colors.text};
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const ContentCard = styled(motion.div)`
  background: ${({ theme }) => theme.colors.background};
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ContentImage = styled.div<{ $imageUrl?: string }>`
  height: 200px;
  background: ${({ $imageUrl }) =>
    $imageUrl ? `url(${$imageUrl}) center/cover` : '#f0f0f0'};
  position: relative;
`;

const ContentInfo = styled.div`
  padding: 1rem;
`;

const ContentTitle = styled.h3`
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: ${({ theme }) => theme.colors.text};
`;

const ContentMeta = styled.div`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 1rem;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled(motion.button)`
  padding: 0.5rem;
  border: none;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

const EditModal = styled(motion.div)`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: ${({ theme }) => theme.colors.background};
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
`;

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  margin-bottom: 1rem;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

interface ContentItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  posterUrl: string;
  addedAt: string;
  source: string;
}

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
`;

const PageButton = styled(motion.button)<{ $active?: boolean }>`
  padding: 0.5rem 1rem;
  border: none;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : theme.colors.surface};
  color: ${({ $active }) => ($active ? 'white' : 'inherit')};
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.surfaceHover};
  }
`;

interface ParserHistoryProps {
  onUpdateContent: (id: string, data: Partial<ContentItem>) => Promise<void>;
  onDeleteContent: (id: string) => Promise<void>;
}

const ParserHistory: React.FC<ParserHistoryProps> = ({
  onUpdateContent,
  onDeleteContent,
}) => {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 40;

  const totalPages = useMemo(() => Math.ceil(content.length / itemsPerPage), [content.length]);
  
  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return content.slice(startIndex, startIndex + itemsPerPage);
  }, [content, currentPage]);

  const fetchHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found, skipping fetch');
        return;
      }

      const response = await fetch('/api/admin/parser/history', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized access, please login again');
          return;
        }
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }

      const data = await response.json();
      setContent(data);
    } catch (error) {
      console.error('Error fetching parser history:', error);
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    fetchHistory();
    interval = setInterval(fetchHistory, 300000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchHistory]);

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item);
  };

  const handleSave = async () => {
    if (!editingItem) return;

    setLoading(true);
    try {
      await onUpdateContent(editingItem.id, editingItem);
      setContent(content.map(item =>
        item.id === editingItem.id ? editingItem : item
      ));
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот контент?')) return;

    try {
      await onDeleteContent(id);
      setContent(content.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting content:', error);
    }
  };

  return (
    <HistoryContainer>
      <HistoryTitle>История добавленного контента</HistoryTitle>
      <ContentGrid>
        {currentItems.map((item) => (
          <ContentCard
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ContentImage $imageUrl={item.posterUrl}>
              {!item.posterUrl && <FiImage size={24} />}
            </ContentImage>
            <ContentInfo>
              <ContentTitle>{item.title}</ContentTitle>
              <ContentMeta>
                {item.type === 'movie' ? 'Фильм' : 'Сериал'} • {item.source} •{' '}
                {new Date(item.addedAt).toLocaleDateString()}
              </ContentMeta>
              <ActionButtons>
                <ActionButton
                  onClick={() => handleEdit(item)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiEdit2 size={14} /> Редактировать
                </ActionButton>
                <ActionButton
                  onClick={() => handleDelete(item.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiTrash2 size={14} /> Удалить
                </ActionButton>
              </ActionButtons>
            </ContentInfo>
          </ContentCard>
        ))}
      </ContentGrid>

      {totalPages > 1 && (
        <Pagination>
          <PageButton
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiChevronLeft /> Назад
          </PageButton>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <PageButton
              key={page}
              $active={currentPage === page}
              onClick={() => setCurrentPage(page)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {page}
            </PageButton>
          ))}
          
          <PageButton
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Вперед <FiChevronRight />
          </PageButton>
        </Pagination>
      )}
      {editingItem && (
        <>
          <Overlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingItem(null)}
          />
          <EditModal
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            <h3>Редактирование контента</h3>
            <Input
              type="text"
              value={editingItem.title}
              onChange={(e) =>
                setEditingItem({ ...editingItem, title: e.target.value })
              }
              placeholder="Название"
            />
            <Input
              type="text"
              value={editingItem.posterUrl}
              onChange={(e) =>
                setEditingItem({ ...editingItem, posterUrl: e.target.value })
              }
              placeholder="URL постера"
            />
            <ActionButtons>
              <ActionButton
                onClick={handleSave}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </ActionButton>
              <ActionButton
                onClick={() => setEditingItem(null)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Отмена
              </ActionButton>
            </ActionButtons>
          </EditModal>
        </>
      )}
      
      {totalPages > 1 && (
        <Pagination>
          <PageButton
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiChevronLeft /> Назад
          </PageButton>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <PageButton
              key={page}
              $active={currentPage === page}
              onClick={() => setCurrentPage(page)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {page}
            </PageButton>
          ))}
          
          <PageButton
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Вперед <FiChevronRight />
          </PageButton>
        </Pagination>
      )}
    </HistoryContainer>
  );
};

export default ParserHistory;