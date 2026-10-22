const http = require('http');

function cleanHtml(str) {
  if (!str) return '';
  return str.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
}

function parseQuality(title) {
  const t = title.toLowerCase();
  if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) return '2160p (4K UHD)';
  if (t.includes('1080p') || t.includes('1080i') || t.includes('remux') || t.includes('bdremux')) return '1080p (Full HD)';
  if (t.includes('720p')) return '720p (HD)';
  if (t.includes('bdrip') || t.includes('web-dlrip') || t.includes('dvdrip')) return 'BDRip / SD';
  return 'HD';
}

function parseVoiceover(title) {
  const t = title.toLowerCase();
  
  if (t.includes('кубик в кубе')) return 'Кубик в Кубе';
  if (t.includes('lostfilm') || t.includes('лостфильм')) return 'LostFilm';
  if (t.includes('red head sound') || t.includes('rhs')) return 'Red Head Sound';
  if (t.includes('hdrezka') || t.includes('резка')) return 'HDRezka';
  if (t.includes('newstudio')) return 'NewStudio';
  if (t.includes('tvshows')) return 'TVShows';
  if (t.includes('гоблин') || t.includes('goblin')) return 'Гоблин (Д. Пучков)';
  if (t.includes('кураж-бамбей')) return 'Кураж-Бамбей';

  // Check tags in bracket / pipe notation common on Rutor: | D | or | D, P |
  const matchTags = title.match(/\|\s*([^|]+)\s*\|/);
  if (matchTags) {
    const tag = matchTags[1];
    if (tag.includes('D')) return 'Дубляж';
    if (tag.includes('P2')) return 'Двухголосый';
    if (tag.includes('P')) return 'Профессиональный (многоголосый)';
    if (tag.includes('A')) return 'Авторский (одноголосый)';
  }

  if (t.includes('дублирован') || t.includes('дубляж') || t.includes('itunes') || t.includes('чистый звук')) return 'Дубляж';
  if (t.includes('многоголосый') || t.includes('проф.')) return 'Многоголосый закадровый';
  if (t.includes('двухголосый')) return 'Двухголосый';
  if (t.includes('авторский') || t.includes('одноголосый')) return 'Авторский (одноголосый)';
  if (t.includes('оригинал') || t.includes('original')) return 'Оригинал (Eng)';
  if (t.includes('субтитр') || t.includes('sub')) return 'Субтитры';

  return 'Оригинальная / Разная';
}

function queryRutor(searchQuery) {
  return new Promise((resolve) => {
    const url = `http://rutor.info/search/0/0/0/0/${encodeURIComponent(searchQuery)}`;
    const req = http.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        const results = [];
        const rowRegex = /<tr class="(?:gai|tum)">([\s\S]*?)<\/tr>/g;
        let match;
        while ((match = rowRegex.exec(html)) !== null) {
          const row = match[1];
          const magnetMatch = row.match(/href="(magnet:\?[^"]+)"/);
          const linkMatch = row.match(/<a href="(\/torrent\/(\d+)[^"]*)">([^<]+)<\/a>/);
          const sizeMatch = row.match(/<td align="right">([^<]+)<\/td>/);
          const seedsMatch = row.match(/<span class="green">.*?(\d+)<\/span>/);
          const leechesMatch = row.match(/<span class="red">.*?(\d+)<\/span>/);

          if (magnetMatch && linkMatch) {
            const rawTitle = cleanHtml(linkMatch[3]);
            const torrentId = linkMatch[2];
            const size = sizeMatch ? cleanHtml(sizeMatch[1]) : '—';
            const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 0;
            const leeches = leechesMatch ? parseInt(leechesMatch[1], 10) : 0;

            results.push({
              id: torrentId,
              title: rawTitle,
              quality: parseQuality(rawTitle),
              voice: parseVoiceover(rawTitle),
              size,
              seeds,
              leeches,
              magnet: magnetMatch[1],
              torrentUrl: `http://d.rutor.info/download/${torrentId}`
            });
          }
        }
        resolve(results);
      });
    });

    req.on('error', (err) => {
      console.warn('Rutor query warning:', err.message);
      resolve([]);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

const TorrentsService = {
  async getTorrents(titleRu, titleEn, year) {
    let items = [];

    // 1. Try search with Russian title
    if (titleRu) {
      items = await queryRutor(titleRu);
    }

    // 2. If nothing found or titleEn exists, also try English title
    if (items.length === 0 && titleEn) {
      items = await queryRutor(titleEn);
    }

    // Sort by seeds descending (most active releases first)
    items.sort((a, b) => b.seeds - a.seeds);

    // Deep-links to popular trackers as quick search shortcuts
    const primaryTitle = titleRu || titleEn;
    const trackerLinks = {
      rutor: `http://rutor.info/search/0/0/0/0/${encodeURIComponent(primaryTitle)}`,
      rutracker: `https://rutracker.org/forum/tracker.php?nm=${encodeURIComponent(primaryTitle)}`,
      nnmclub: `https://nnmclub.to/forum/tracker.php?nm=${encodeURIComponent(primaryTitle)}`,
      kinozal: `https://kinozal.tv/browse.php?s=${encodeURIComponent(primaryTitle)}`
    };

    return {
      query: primaryTitle,
      total: items.length,
      items,
      trackerLinks
    };
  }
};

module.exports = TorrentsService;
