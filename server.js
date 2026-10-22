require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = 'ffmpeg';
}

const KinopoiskService = require('./services/kinopoisk');
const PlayersService = require('./services/players');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Never cache static files in development
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
}));

// Helper to fetch playlist text with headers
function fetchTextWithHeaders(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://api.nextembed.ws/',
        'Origin': 'https://api.nextembed.ws'
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy());
  });
}

// 1. Популярные
app.get('/api/movies/popular', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const data = await KinopoiskService.getPopular(page);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 2. Топ-250 всех 250 фильмов
app.get('/api/movies/top250/all', (req, res) => {
  const fs = require('fs');
  const cacheFile = path.join(__dirname, '.cache', 'top250_all.json');
  if (fs.existsSync(cacheFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      return res.json({ total: data.length, items: data });
    } catch (e) {}
  }
  KinopoiskService.getTop250(1)
    .then(data => res.json(data))
    .catch(err => res.status(500).json({ error: true, message: err.message }));
});

// 2.1. Топ-250 постранично
app.get('/api/movies/top250', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const data = await KinopoiskService.getTop250(page);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 3. Сериалы
app.get('/api/movies/series', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const data = await KinopoiskService.getSeries(page);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 4. Поиск
app.get('/api/movies/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const page = parseInt(req.query.page, 10) || 1;
    const data = await KinopoiskService.search(query, page);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 5. Фильтры
app.get('/api/movies/filters', async (req, res) => {
  try {
    const data = await KinopoiskService.getFilters();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 6. Каталог с фильтрами
app.get('/api/movies/filter', async (req, res) => {
  try {
    const data = await KinopoiskService.getFiltered({
      genreId: req.query.genre,
      countryId: req.query.country,
      order: req.query.order || 'RATING',
      type: req.query.type || 'ALL',
      ratingFrom: req.query.ratingFrom || 1,
      yearFrom: req.query.yearFrom || 1960,
      yearTo: req.query.yearTo || 2026,
      page: parseInt(req.query.page, 10) || 1
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 7. Детали фильма
app.get('/api/movies/:id', async (req, res) => {
  try {
    const filmId = req.params.id;
    const [details, staff, videos] = await Promise.allSettled([
      KinopoiskService.getFilmDetails(filmId),
      KinopoiskService.getFilmStaff(filmId),
      KinopoiskService.getFilmVideos(filmId)
    ]);

    const result = {
      ...(details.status === 'fulfilled' ? details.value : {}),
      staff: staff.status === 'fulfilled' && Array.isArray(staff.value) ? staff.value.slice(0, 15) : [],
      videos: videos.status === 'fulfilled' && videos.value?.items ? videos.value.items : []
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 8. Плееры и источники
app.get('/api/movies/:id/players', async (req, res) => {
  try {
    const filmId = req.params.id;
    const title = req.query.title || '';
    const players = await PlayersService.getPlayers(filmId, title);
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 9. Прямое скачивание MP4 видеофайла
app.get('/api/movies/:id/download-mp4', async (req, res) => {
  try {
    const filmId = req.params.id;
    const requestedQuality = req.query.quality || '720p';
    const rawTitle = req.query.title || `movie_${filmId}`;
    const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    const filename = `${cleanTitle}_${requestedQuality}.mp4`;

    const playerData = await PlayersService.getPlayers(filmId);
    let targetM3u8 = '';

    if (playerData.directStream && playerData.directStream.m3u8Url) {
      const masterUrl = playerData.directStream.m3u8Url;
      try {
        const masterPlaylist = await fetchTextWithHeaders(masterUrl);
        const lines = masterPlaylist.split('\n');
        
        let foundSubUrl = '';
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('#EXT-X-STREAM-INF')) {
            const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
            if (nextLine.startsWith('http')) {
              if (requestedQuality === '720p' && (line.includes('648x') || line.includes('720'))) {
                foundSubUrl = nextLine;
                break;
              } else if (requestedQuality === '480p' && (line.includes('480') || line.includes('270'))) {
                foundSubUrl = nextLine;
                break;
              } else if (!foundSubUrl) {
                foundSubUrl = nextLine;
              }
            }
          }
        }
        targetM3u8 = foundSubUrl || masterUrl;
      } catch (e) {
        targetM3u8 = masterUrl;
      }
    }

    if (!targetM3u8) {
      return res.status(404).send('Прямой видеопоток для этого фильма временно недоступен.');
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const headers = "Referer: https://api.nextembed.ws/\r\nOrigin: https://api.nextembed.ws\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n";
    const args = [
      '-headers', headers,
      '-i', targetM3u8,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', 'frag_keyframe+empty_moov',
      '-f', 'mp4',
      'pipe:1'
    ];

    const bin = ffmpegPath || 'ffmpeg';
    const proc = spawn(bin, args);
    proc.stdout.pipe(res);

    proc.stderr.on('data', () => {});

    res.on('close', () => {
      try { proc.kill('SIGKILL'); } catch (e) {}
    });

    proc.on('error', (err) => {
      console.error('FFmpeg pipe error:', err.message);
      if (!res.writableEnded) res.end();
    });
  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Ошибка при подготовке скачивания: ' + err.message);
    }
  }
});

// Dedicated Movie Page route
app.get('/movie/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'movie.html'));
});

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎬 КиноХаб сервер запущен на http://localhost:${PORT}`);
  });
}

module.exports = app;
