const https = require('https');
const http = require('http');

function fetchText(url, options = {}) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const req = lib.get(url, options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
    });
    req.on('error', () => resolve(''));
    req.setTimeout(6000, () => {
      req.destroy();
      resolve('');
    });
  });
}

function fetchJson(url, options = {}) {
  return fetchText(url, options).then(txt => {
    try {
      return JSON.parse(txt);
    } catch (e) {
      return null;
    }
  });
}

const PlayersService = {
  async getPlayers(kinopoiskId, title = '') {
    const balancers = [];
    let directStream = null;
    let collapsEmbedUrl = '';

    // 1. Fetch balancers from aggregator
    try {
      const fbData = await fetchJson(`https://fbphdplay.top/api/players?kinopoisk=${kinopoiskId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://fbphdplay.top',
          'Referer': 'https://fbphdplay.top/'
        }
      });

      if (fbData && fbData.data && Array.isArray(fbData.data)) {
        for (const item of fbData.data) {
          if (!item.iframeUrl) continue;

          if (item.type && item.type.toLowerCase().includes('collaps')) {
            collapsEmbedUrl = item.iframeUrl;
          }
          
          const cleanTranslations = (item.translations || [])
            .filter(t => t && t.iframeUrl)
            .map(t => ({
              id: t.id,
              name: t.name || 'Стандартная',
              quality: t.quality || 'Auto',
              iframeUrl: t.iframeUrl
            }));

          balancers.push({
            name: item.type || 'Источник',
            defaultIframe: item.iframeUrl,
            translations: cleanTranslations
          });
        }
      }
    } catch (e) {
      console.error('Error fetching fbphdplay:', e.message);
    }

    // Fallback collaps URL if not found
    if (!collapsEmbedUrl) {
      collapsEmbedUrl = `https://api.nextembed.ws/embed/movie/${kinopoiskId}`;
    }

    // 2. Extract direct stream from Collaps using its actual iframe URL
    try {
      const collapsHtml = await fetchText(collapsEmbedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://kinopoisk.ru'
        }
      });

      if (collapsHtml) {
        const m3u8Match = collapsHtml.match(/hls:\s*"([^"]+)"/);
        const audioMatch = collapsHtml.match(/audio:\s*(\{[^}]+\})/);

        if (m3u8Match) {
          let audioNames = [];
          if (audioMatch) {
            try {
              const audioObj = JSON.parse(audioMatch[1]);
              audioNames = audioObj.names || [];
            } catch (err) {}
          }

          directStream = {
            m3u8Url: m3u8Match[1].replace(/\\/g, ''),
            audios: audioNames,
            qualities: ['1080p', '720p', '480p', '360p']
          };
        }
      }
    } catch (e) {
      console.error('Error extracting direct stream:', e.message);
    }

    // Fallbacks
    if (!balancers.some(b => b.name.toLowerCase().includes('collaps'))) {
      balancers.push({
        name: 'Collaps',
        defaultIframe: collapsEmbedUrl,
        translations: [
          { name: 'Основная озвучка (1080p)', quality: '1080p', iframeUrl: collapsEmbedUrl }
        ]
      });
    }

    if (!balancers.some(b => b.name.toLowerCase().includes('veoveo'))) {
      balancers.push({
        name: 'Veoveo',
        defaultIframe: `https://player.shortener2.link/balancer-api/iframe?movie_id=15652`,
        translations: []
      });
    }

    // SORT PRIORITY: Collaps #1, Veoveo #2, Turbo #3, Alloha #4
    const priority = { 'collaps': 1, 'veoveo': 2, 'turbo': 3, 'alloha': 4 };
    balancers.sort((a, b) => {
      const pA = priority[a.name.toLowerCase()] || 99;
      const pB = priority[b.name.toLowerCase()] || 99;
      return pA - pB;
    });

    return {
      kinopoiskId,
      balancers,
      directStream
    };
  }
};

module.exports = PlayersService;
