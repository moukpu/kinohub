require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ffmpeg: !!ffmpegPath,
    uptime: process.uptime()
  });
});

app.get('/api/debug-ffmpeg', (req, res) => {
  const bin = ffmpegPath || 'ffmpeg';
  const { execFile } = require('child_process');
  execFile(bin, ['-version'], (err, stdout, stderr) => {
    res.json({
      bin,
      exists: fs.existsSync(bin),
      platform: process.platform,
      arch: process.arch,
      error: err ? { message: err.message, code: err.code } : null,
      stdout: stdout ? stdout.slice(0, 300) : null,
      stderr: stderr ? stderr.slice(0, 300) : null
    });
  });
});

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

    // If running on Vercel serverless environment, redirect to persistent Render backend to avoid 300s timeout
    if (process.env.VERCEL) {
      const qs = new URLSearchParams(req.query).toString();
      return res.redirect(307, `https://kinohub-api.onrender.com/api/movies/${filmId}/download-mp4${qs ? '?' + qs : ''}`);
    }

    const requestedQuality = req.query.quality || '720p';
    const requestedVoice = req.query.voice || '';
    const rawTitle = req.query.title || `movie_${filmId}`;
    const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);

    const playerData = await PlayersService.getPlayers(filmId);
    let targetVideoM3u8 = '';
    let targetAudioM3u8 = '';
    let actualQuality = requestedQuality;

    if (playerData.directStream && playerData.directStream.m3u8Url) {
      const masterUrl = playerData.directStream.m3u8Url;
      try {
        const masterPlaylist = await fetchTextWithHeaders(masterUrl);
        const lines = masterPlaylist.split('\n');

        // Parse audio tracks
        const audioTracks = [];
        for (const line of lines) {
          if (line.includes('#EXT-X-MEDIA:TYPE=AUDIO') && line.includes('URI=')) {
            const uriMatch = line.match(/URI="([^"]+)"/);
            const nameMatch = line.match(/NAME="([^"]+)"/);
            if (uriMatch) {
              const uri = uriMatch[1];
              const isXbc = uri.includes('x-bc.interkh.com');
              const name = nameMatch ? nameMatch[1] : '';
              audioTracks.push({ uri, isXbc, name, line });
            }
          }
        }

        // Pick matching or preferred audio track
        if (audioTracks.length > 0) {
          let chosenAudio = null;
          if (requestedVoice && playerData.directStream.audios && Array.isArray(playerData.directStream.audios)) {
            const voiceIndex = playerData.directStream.audios.findIndex(a => 
              a.toLowerCase() === requestedVoice.toLowerCase() || 
              requestedVoice.toLowerCase().includes(a.toLowerCase()) ||
              a.toLowerCase().includes(requestedVoice.toLowerCase())
            );
            if (voiceIndex >= 0) {
              const needle = `index-a${voiceIndex + 1}.m3u8`;
              chosenAudio = audioTracks.find(a => a.uri.includes(needle) && a.isXbc) ||
                            audioTracks.find(a => a.uri.includes(needle));
            }
          }

          if (!chosenAudio) {
            chosenAudio = audioTracks.find(a => a.uri.includes('index-a1.m3u8') && a.isXbc) ||
                          audioTracks.find(a => a.isXbc) ||
                          audioTracks[0];
          }

          targetAudioM3u8 = chosenAudio ? chosenAudio.uri : '';
        }

        // Parse video streams
        const videoStreams = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('#EXT-X-STREAM-INF')) {
            const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
            if (nextLine.startsWith('http')) {
              videoStreams.push({
                info: line,
                url: nextLine,
                isXbc: nextLine.includes('x-bc.interkh.com')
              });
            }
          }
        }

        actualQuality = requestedQuality;
        // Filter video streams according to requested quality
        if (videoStreams.length > 0) {
          let matched = [];
          if (requestedQuality === '1080p') {
            matched = videoStreams.filter(v => v.info.includes('1920x') || v.info.includes('1080'));
            if (matched.length > 0) actualQuality = '1080p';
          } else if (requestedQuality === '720p') {
            matched = videoStreams.filter(v => v.info.includes('1280x') || v.info.includes('720') || v.info.includes('648x'));
            if (matched.length > 0) actualQuality = '720p';
          } else if (requestedQuality === '480p') {
            matched = videoStreams.filter(v => v.info.includes('854x') || v.info.includes('480') || v.info.includes('640x360'));
            if (matched.length > 0) actualQuality = '480p';
          }

          if (matched.length === 0) {
            matched = videoStreams;
            if (matched[0].info.includes('1920x') || matched[0].info.includes('1080')) actualQuality = '1080p';
            else if (matched[0].info.includes('1280x') || matched[0].info.includes('720') || matched[0].info.includes('648x')) actualQuality = '720p';
            else actualQuality = '480p';
          }
          const xbcMatched = matched.filter(v => v.isXbc);
          targetVideoM3u8 = xbcMatched.length > 0 ? xbcMatched[0].url : matched[0].url;
        } else {
          targetVideoM3u8 = masterUrl;
        }
      } catch (e) {
        targetVideoM3u8 = masterUrl;
      }
    }

    if (!targetVideoM3u8) {
      return res.status(404).send('Прямой видеопоток для этого фильма временно недоступен.');
    }

    const filename = `${cleanTitle}_${actualQuality}.mp4`;
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const headers = "Referer: https://api.nextembed.ws/\r\nOrigin: https://api.nextembed.ws\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n";
    const args = ['-headers', headers, '-i', targetVideoM3u8];

    if (targetAudioM3u8) {
      args.push('-headers', headers, '-i', targetAudioM3u8);
      args.push('-map', '0:v:0', '-map', '1:a:0');
    } else {
      args.push('-map', '0:v:0', '-map', '0:a:0?');
    }

    args.push(
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      '-af', 'aresample=async=1',
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1'
    );

    const bin = ffmpegPath || 'ffmpeg';
    const proc = spawn(bin, args);
    proc.stdout.pipe(res);

    proc.stderr.on('data', (data) => {
      // Log errors or warnings if needed
    });

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
