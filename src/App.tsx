import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import MoviesPage from '@/pages/MoviesPage';
import TVPage from '@/pages/TVPage';
import AnimePage from '@/pages/AnimePage';
import AnimeDetailPage from '@/pages/AnimeDetailPage';
import MovieDetailPage from '@/pages/MovieDetailPage';
import TVDetailPage from '@/pages/TVDetailPage';
import WatchPage from '@/pages/WatchPage';
import EmbedPage from '@/pages/EmbedPage';
import SearchPage from '@/pages/SearchPage';
import MyListPage from '@/pages/MyListPage';
import HistoryPage from '@/pages/HistoryPage';
import ApiPage from '@/pages/ApiPage';
import StreamConfiguratorPage from '@/pages/StreamConfiguratorPage';
import PersonPage from '@/pages/PersonPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { useTheme } from '@/lib/theme';

/**
 * Routes.
 *
 * Mirrors frameXTV.xyz's router exactly: the same public paths, the same
 * `/embed/*` family outside the site shell, and `/docs` aliased to the API
 * page. React Router ranks a static segment above a dynamic one, so
 * `/anime/:anilistId` and `/watch/anime/:anilistId` win over `/movie/:id`
 * style siblings without needing explicit ordering.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 300_000,
      retry: 2,
    },
  },
});

export default function App() {
  // Applies the device theme to <html> and follows it live. There is no
  // toggle and no provider — the whole scheme is CSS on the root attribute, so
  // this single call site is all the wiring it needs.
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Bare player, outside the site chrome. */}
          <Route path="/embed/anime/*" element={<EmbedPage />} />
          <Route path="/embed/anime" element={<EmbedPage />} />
          <Route path="/anime/embed/*" element={<EmbedPage />} />
          <Route path="/anime/embed" element={<EmbedPage />} />
          <Route path="/embed/movie/:tmdbId" element={<EmbedPage />} />
          <Route path="/embed/tv/:tmdbId/:season/:episode" element={<EmbedPage />} />
          <Route path="/embed/tv/:tmdbId" element={<EmbedPage />} />
          <Route path="/embed/series/:tmdbId/:season/:episode" element={<EmbedPage />} />
          <Route path="/embed/:tmdbId/:season/:episode" element={<EmbedPage />} />
          <Route path="/embed/:tmdbId" element={<EmbedPage />} />
          <Route path="/embed/*" element={<EmbedPage />} />
          <Route path="/embed" element={<EmbedPage />} />

          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/tv" element={<TVPage />} />
            <Route path="/anime" element={<AnimePage />} />
            <Route path="/anime/:anilistId" element={<AnimeDetailPage />} />
            <Route path="/api" element={<ApiPage />} />
            <Route path="/docs" element={<ApiPage />} />
            <Route path="/docs/*" element={<ApiPage />} />
            <Route path="/configurator" element={<StreamConfiguratorPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/my-list" element={<MyListPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/movie/:id" element={<MovieDetailPage />} />
            <Route path="/movie/:tmdbId" element={<MovieDetailPage />} />
            <Route path="/tv/:id" element={<TVDetailPage />} />
            <Route path="/tv/:tmdbId" element={<TVDetailPage />} />
            <Route path="/watch/anime/:anilistId" element={<WatchPage />} />
            <Route path="/watch/anime/:anilistId/:episode" element={<WatchPage />} />
            <Route path="/watch/:tmdbId" element={<WatchPage />} />
            <Route path="/watch/:tmdbId/:season/:episode" element={<WatchPage />} />
            <Route path="/person/:tmdbId" element={<PersonPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
