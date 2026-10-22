// API client for KinoHub backend
const API = {
  baseUrl: '',

  async get(endpoint, params = {}) {
    const url = new URL(endpoint, window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      return { error: true, message: err.message };
    }
  },

  getPopular(page = 1) {
    return this.get('/api/movies/popular', { page });
  },

  getTop250(page = 1) {
    return this.get('/api/movies/top250', { page });
  },

  getAllTop250() {
    return this.get('/api/movies/top250/all');
  },

  getSeries(page = 1) {
    return this.get('/api/movies/series', { page });
  },

  search(query, page = 1) {
    return this.get('/api/movies/search', { q: query, page });
  },

  getFilters() {
    return this.get('/api/movies/filters');
  },

  getFiltered(filters = {}) {
    return this.get('/api/movies/filter', filters);
  },

  getDetails(filmId) {
    return this.get(`/api/movies/${filmId}`);
  },

  getPlayers(filmId, title = '') {
    return this.get(`/api/movies/${filmId}/players`, { title });
  },

  getTorrents(filmId, titleRu, titleEn, year) {
    return this.get(`/api/movies/${filmId}/torrents`, { titleRu, titleEn, year });
  }
};
