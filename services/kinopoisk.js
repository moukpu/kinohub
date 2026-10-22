const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API_KEY = process.env.KINOPOISK_API_KEY || '90212a7f-e7ea-4e21-9a3f-4166d2264747';
const BASE_HOST = 'kinopoiskapiunofficial.tech';
const CACHE_DIR = path.join(__dirname, '..', '.cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const memCache = new Map();

function getCacheKey(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function readCache(apiPath) {
  if (memCache.has(apiPath)) {
    return memCache.get(apiPath);
  }

  const key = getCacheKey(apiPath);
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      memCache.set(apiPath, parsed);
      return parsed;
    } catch (e) {}
  }
  return null;
}

function writeCache(apiPath, data) {
  memCache.set(apiPath, data);
  const key = getCacheKey(apiPath);
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Cache write error:', e.message);
  }
}

function requestKP(reqPath) {
  const cached = readCache(reqPath);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    console.log(`[KP API Request] Fetching: ${reqPath}`);
    const options = {
      hostname: BASE_HOST,
      path: reqPath,
      method: 'GET',
      headers: {
        'X-API-KEY': API_KEY,
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'Mozilla/5.0'
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = JSON.parse(raw);
            writeCache(reqPath, parsed);
            resolve(parsed);
          } else {
            console.error(`KP API error ${res.statusCode} for ${reqPath}:`, raw.slice(0, 150));
            resolve({ error: true, status: res.statusCode, message: raw });
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      console.error('KP API network error:', err.message);
      reject(err);
    });

    req.setTimeout(10000, () => {
      req.destroy(new Error('KP API timeout'));
    });

    req.end();
  });
}

const KinopoiskService = {
  async getPopular(page = 1) {
    return requestKP(`/api/v2.2/films/collections?type=TOP_POPULAR_ALL&page=${page}`);
  },

  async getTop250(page = 1) {
    return requestKP(`/api/v2.2/films/collections?type=TOP_250_MOVIES&page=${page}`);
  },

  async getSeries(page = 1) {
    return requestKP(`/api/v2.2/films/collections?type=TOP_250_TV_SHOWS&page=${page}`);
  },

  async search(keyword, page = 1) {
    if (!keyword) return { items: [] };
    const encoded = encodeURIComponent(keyword.trim().toLowerCase());
    const res = await requestKP(`/api/v2.1/films/search-by-keyword?keyword=${encoded}&page=${page}`);
    if (res.films) {
      return {
        total: res.searchFilmsCountResult || res.films.length,
        totalPages: res.pagesCount || 1,
        items: res.films.map(f => ({
          kinopoiskId: f.filmId,
          nameRu: f.nameRu,
          nameEn: f.nameEn,
          nameOriginal: f.nameOriginal || f.nameEn,
          year: f.year,
          genres: f.genres,
          countries: f.countries,
          ratingKinopoisk: f.rating && !isNaN(parseFloat(f.rating)) ? parseFloat(f.rating) : null,
          posterUrl: f.posterUrl,
          posterUrlPreview: f.posterUrlPreview,
          description: f.description,
          type: f.type || 'FILM'
        }))
      };
    }
    return res;
  },

  async getFilters() {
    return requestKP('/api/v2.2/films/filters');
  },

  async getFiltered(params = {}) {
    const {
      genreId,
      countryId,
      order = 'RATING',
      type = 'ALL',
      ratingFrom = 1,
      yearFrom = 1950,
      yearTo = 2026,
      page = 1
    } = params;

    let p = `/api/v2.2/films?order=${order}&type=${type}&ratingFrom=${ratingFrom}&yearFrom=${yearFrom}&yearTo=${yearTo}&page=${page}`;
    if (genreId) p += `&genres=${genreId}`;
    if (countryId) p += `&countries=${countryId}`;

    return requestKP(p);
  },

  async getFilmDetails(id) {
    return requestKP(`/api/v2.2/films/${id}`);
  },

  async getFilmStaff(id) {
    return requestKP(`/api/v1/staff?filmId=${id}`);
  },

  async getFilmVideos(id) {
    return requestKP(`/api/v2.2/films/${id}/videos`);
  },

  async getFilmSeasons(id) {
    return requestKP(`/api/v2.2/films/${id}/seasons`);
  },

  async getFilmSimilars(id) {
    return requestKP(`/api/v2.2/films/${id}/similars`);
  }
};

module.exports = KinopoiskService;
