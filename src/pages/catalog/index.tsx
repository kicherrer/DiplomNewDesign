import React, { useState } from 'react';
import styled from 'styled-components';
import Layout from '../../components/Layout/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFilter, FiChevronDown } from 'react-icons/fi';

interface FilterState {
  genre: string[];
  year: string;
  rating: string;
  sort: string;
}

const CatalogContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
  position: relative;
`;

const FilterPanel = styled(motion.div)`
  width: 280px;
  background: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.md};
  position: sticky;
  top: 100px;
  height: fit-content;
`;

const FilterSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const FilterTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
`;

const ContentGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

const MovieCard = styled(motion.div)`
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  cursor: pointer;
  box-shadow: ${({ theme }) => theme.shadows.md};
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-4px);
  }
`;

const MovieImage = styled.img`
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
`;

const MovieInfo = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
`;

const MovieTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const MovieMeta = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  display: flex;
  justify-content: space-between;
`;

const Checkbox = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const CatalogPage: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({
    genre: [],
    year: '',
    rating: '',
    sort: 'popularity'
  });

  const movies = [
    {
      id: 1,
      title: 'Inception',
      year: 2010,
      rating: 8.8,
      image: 'https://via.placeholder.com/300x450'
    },
    // Add more movie data here
  ];

  const genres = [
    'Боевик',
    'Драма',
    'Комедия',
    'Фантастика',
    'Триллер',
    'Ужасы',
    'Приключения',
    'Мультфильм'
  ];

  return (
    <Layout>
      <CatalogContainer>
        <FilterPanel
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <FilterSection>
            <FilterTitle>
              Жанры <FiChevronDown />
            </FilterTitle>
            {genres.map((genre) => (
              <Checkbox key={genre}>
                <input
                  type="checkbox"
                  checked={filters.genre.includes(genre)}
                  onChange={(e) => {
                    const newGenres = e.target.checked
                      ? [...filters.genre, genre]
                      : filters.genre.filter((g) => g !== genre);
                    setFilters({ ...filters, genre: newGenres });
                  }}
                />
                {genre}
              </Checkbox>
            ))}
          </FilterSection>

          <FilterSection>
            <FilterTitle>
              Год выпуска <FiChevronDown />
            </FilterTitle>
            {/* Add year range slider or select here */}
          </FilterSection>

          <FilterSection>
            <FilterTitle>
              Рейтинг <FiChevronDown />
            </FilterTitle>
            {/* Add rating filter controls here */}
          </FilterSection>
        </FilterPanel>

        <ContentGrid>
          <AnimatePresence>
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
              >
                <MovieImage src={movie.image} alt={movie.title} />
                <MovieInfo>
                  <MovieTitle>{movie.title}</MovieTitle>
                  <MovieMeta>
                    <span>{movie.year}</span>
                    <span>★ {movie.rating}</span>
                  </MovieMeta>
                </MovieInfo>
              </MovieCard>
            ))}
          </AnimatePresence>
        </ContentGrid>
      </CatalogContainer>
    </Layout>
  );
};

export default CatalogPage;