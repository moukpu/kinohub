// KinoHub - Dedicated Movie Page Script
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  let filmId = urlParams.get('id') || urlParams.get('filmId');
  if (!filmId) {
    const match = window.location.pathname.match(/\/movie\/(\d+)/);
    if (match) filmId = match[1];
  }

  if (!filmId) {
    window.location.href = '/';
    return;
  }

  // Header Search
  const headerSearchInput = document.getElementById('headerSearchInput');
  const headerSearchBtn = document.getElementById('headerSearchBtn');
  function doSearch() {
    const q = headerSearchInput.value.trim();
    if (q) window.location.href = `/?search=${encodeURIComponent(q)}`;
  }
  headerSearchBtn.onclick = doSearch;
  headerSearchInput.onkeydown = (e) => {
    if (e.key === 'Enter') doSearch();
  };

  // DOM Elements
  const bcCategory = document.getElementById('bcCategory');
  const bcTitle = document.getElementById('bcTitle');
  const moviePoster = document.getElementById('moviePoster');
  const movieAgeBadge = document.getElementById('movieAgeBadge');
  const movieTitleRu = document.getElementById('movieTitleRu');
  const movieTitleOrig = document.getElementById('movieTitleOrig');
  const movieRatings = document.getElementById('movieRatings');
  const specYear = document.getElementById('specYear');
  const specCountry = document.getElementById('specCountry');
  const specGenre = document.getElementById('specGenre');
  const specSlogan = document.getElementById('specSlogan');
  const specDuration = document.getElementById('specDuration');
  const movieDescription = document.getElementById('movieDescription');
  const heroBookmarkBtn = document.getElementById('heroBookmarkBtn');

  // Player Elements
  const serverTabsList = document.getElementById('serverTabsList');
  const playerOptionsBar = document.getElementById('playerOptionsBar');
  const movieVoiceoverSelect = document.getElementById('movieVoiceoverSelect');
  const reloadPlayerBtn = document.getElementById('reloadPlayerBtn');
  const cinemaIframe = document.getElementById('cinemaIframe');

  // Releases Elements
  const releasesList = document.getElementById('releasesList');
  const similarBlock = document.getElementById('similarBlock');
  const similarGrid = document.getElementById('similarGrid');

  let currentMovie = null;
  let currentPlayers = [];
  let currentActiveBalancer = null;

  // Toast notification
  function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // Bookmarks Storage
  function getBookmarks() {
    return JSON.parse(localStorage.getItem('kinohub_bookmarks') || '[]');
  }
  function isBookmarked(id) {
    return getBookmarks().some(m => String(m.kinopoiskId || m.filmId) === String(id));
  }
  function updateBookmarkBtn(id) {
    if (isBookmarked(id)) {
      heroBookmarkBtn.innerHTML = '★ В закладках';
      heroBookmarkBtn.classList.add('btn-bookmarked');
    } else {
      heroBookmarkBtn.innerHTML = '🔖 В закладки';
      heroBookmarkBtn.classList.remove('btn-bookmarked');
    }
  }
  heroBookmarkBtn.onclick = () => {
    if (!currentMovie) return;
    let bms = getBookmarks();
    const id = currentMovie.kinopoiskId || currentMovie.filmId;
    if (isBookmarked(id)) {
      bms = bms.filter(m => String(m.kinopoiskId || m.filmId) !== String(id));
      localStorage.setItem('kinohub_bookmarks', JSON.stringify(bms));
      showToast('Удалено из закладок');
    } else {
      bms.push(currentMovie);
      localStorage.setItem('kinohub_bookmarks', JSON.stringify(bms));
      showToast('Добавлено в закладки');
    }
    updateBookmarkBtn(id);
  };

  // 1. Fetch Movie Details
  try {
    const details = await API.getDetails(filmId);
    if (!details || details.error) {
      movieTitleRu.textContent = 'Ошибка загрузки информации о фильме';
      return;
    }

    currentMovie = details;
    const titleRu = details.nameRu || details.nameOriginal || 'Без названия';
    const titleEn = details.nameOriginal || details.nameEn || '';
    const year = details.year || '';
    const poster = details.posterUrl || details.posterUrlPreview || '';

    document.title = `${titleRu} (${year}) смотреть онлайн — КиноХаб`;

    // Breadcrumbs
    bcCategory.textContent = details.type === 'TV_SERIES' ? 'Сериалы' : 'Фильмы';
    bcTitle.textContent = `${titleRu} (${year})`;

    // Hero
    moviePoster.src = poster;
    moviePoster.alt = titleRu;

    if (details.ratingAgeLimits) {
      const ageNum = details.ratingAgeLimits.replace('age', '');
      movieAgeBadge.textContent = `${ageNum}+`;
      movieAgeBadge.style.display = 'block';
    }

    movieTitleRu.textContent = titleRu;
    movieTitleOrig.textContent = titleEn ? `${titleEn} (${year})` : year;

    // Ratings
    let ratingsHtml = '';
    const kpRating = details.ratingKinopoisk || details.rating;
    if (kpRating) {
      ratingsHtml += `<div class="rating-badge rating-kp">⭐ Кинопоиск: <strong>${parseFloat(kpRating).toFixed(1)}</strong></div>`;
    }
    if (details.ratingImdb) {
      ratingsHtml += `<div class="rating-badge rating-imdb">IMDb: <strong>${parseFloat(details.ratingImdb).toFixed(1)}</strong></div>`;
    }
    movieRatings.innerHTML = ratingsHtml;

    // Specs
    specYear.textContent = year || '—';
    specCountry.textContent = (details.countries || []).map(c => c.country).join(', ') || '—';
    specGenre.textContent = (details.genres || []).map(g => g.genre).join(', ') || '—';
    
    if (details.slogan) {
      specSlogan.textContent = `«${details.slogan}»`;
    } else {
      document.getElementById('rowSlogan').style.display = 'none';
    }

    if (details.filmLength) {
      const mins = details.filmLength;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      specDuration.textContent = h > 0 ? `${mins} мин. (${h} ч ${m} мин)` : `${mins} мин.`;
    } else {
      document.getElementById('rowDuration').style.display = 'none';
    }

    movieDescription.textContent = details.description || details.shortDescription || 'Описание фильма пока отсутствует.';
    updateBookmarkBtn(filmId);

    // 2. Load Players & Balancers
    loadPlayers(filmId, details);

    // 3. Load Torrents & Downloads
    loadTorrents(filmId, titleRu, details.nameOriginal, year);

    // 4. Load Similar Movies
    loadSimilar(details);

  } catch (err) {
    console.error('Error loading movie page:', err);
    movieTitleRu.textContent = 'Ошибка загрузки данных';
  }

  // Setup Players
  async function loadPlayers(id, details) {
    try {
      const playersData = await API.getPlayers(id, details.nameRu);
      let balancers = (playersData && playersData.balancers) ? [...playersData.balancers] : [];

      // Ensure Collaps is always present as fallback
      if (!balancers.some(b => b.name.toLowerCase().includes('collaps'))) {
        balancers.unshift({
          name: 'Collaps',
          defaultIframe: `https://api.nextembed.ws/embed/movie/${id}`,
          translations: []
        });
      }

      // Add backup server if IMDb ID exists
      if (details.imdbId && !balancers.some(b => b.name.toLowerCase().includes('autoembed'))) {
        balancers.push({
          name: 'Резерв',
          defaultIframe: `https://player.autoembed.cc/embed/movie/${details.imdbId}`,
          translations: []
        });
      }

      currentPlayers = balancers;
      serverTabsList.innerHTML = '';

      balancers.forEach((b, idx) => {
        const btn = document.createElement('button');
        btn.className = `server-tab ${idx === 0 ? 'active' : ''}`;
        btn.innerHTML = `🎬 Сервер ${idx + 1} <span class="tab-sub">(${b.name})</span>`;
        btn.onclick = () => switchServer(b, btn);
        serverTabsList.appendChild(btn);
      });

      if (balancers.length > 0) {
        switchServer(balancers[0], serverTabsList.children[0]);
      }
    } catch (e) {
      console.error('Player load error:', e);
      serverTabsList.innerHTML = `
        <button class="server-tab active" onclick="this.parentElement.nextElementSibling.querySelector('iframe').src='https://api.nextembed.ws/embed/movie/${id}'">
          🎬 Сервер 1 (Collaps)
        </button>
      `;
      cinemaIframe.src = `https://api.nextembed.ws/embed/movie/${id}`;
    }
  }

  function switchServer(balancer, tabBtn) {
    currentActiveBalancer = balancer;
    document.querySelectorAll('.server-tab').forEach(t => t.classList.remove('active'));
    if (tabBtn) tabBtn.classList.add('active');

    // Handle translations / voiceovers
    if (balancer.translations && balancer.translations.length > 1) {
      playerOptionsBar.style.display = 'flex';
      movieVoiceoverSelect.innerHTML = balancer.translations.map(t => 
        `<option value="${t.iframeUrl}">${t.name} (${t.quality || 'HD'})</option>`
      ).join('');

      movieVoiceoverSelect.onchange = () => {
        cinemaIframe.src = movieVoiceoverSelect.value;
      };
      cinemaIframe.src = balancer.translations[0].iframeUrl;
    } else {
      playerOptionsBar.style.display = 'none';
      cinemaIframe.src = balancer.defaultIframe;
    }
  }

  reloadPlayerBtn.onclick = () => {
    if (cinemaIframe.src) {
      const cur = cinemaIframe.src;
      cinemaIframe.src = '';
      setTimeout(() => cinemaIframe.src = cur, 100);
      showToast('Плеер перезагружается...');
    }
  };

  // Setup Downloads
  async function loadTorrents(id, titleRu, titleEn, year) {
    try {
      const torrents = await API.getTorrents(id, titleRu, titleEn, year);
      if (!torrents || !torrents.items || torrents.items.length === 0) {
        releasesList.innerHTML = `
          <div class="releases-empty">
            Для этого фильма пока нет прямых торрент-раздач. Вы можете смотреть его онлайн в высоком качестве в плеере выше.
          </div>
        `;
        return;
      }

      releasesList.innerHTML = torrents.items.slice(0, 40).map(t => {
        const downloadFileUrl = `/api/torrents/download/${t.id}?name=${encodeURIComponent(t.title)}`;
        return `
          <div class="release-item-card">
            <div class="release-main-info">
              <div class="release-title-text">${t.title}</div>
              <div class="release-tags-row">
                <span class="badge badge-quality">${t.quality}</span>
                <span class="badge badge-voice">${t.voice}</span>
                <span class="release-size">📁 ${t.size}</span>
                <span class="release-seeds">🟢 ${t.seeds} раздают</span>
              </div>
            </div>
            <div class="release-btn-group">
              <a href="${downloadFileUrl}" class="btn btn-primary btn-sm release-btn" download="${t.title}.torrent">
                ⬇ Скачать .torrent
              </a>
              <a href="${t.magnet}" class="btn btn-secondary btn-sm release-btn" title="Открыть в приложении">
                🧲 Magnet
              </a>
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      console.error('Torrents load error:', e);
      releasesList.innerHTML = '<div class="releases-empty">Не удалось загрузить список раздач.</div>';
    }
  }

  // Setup Similar Movies
  async function loadSimilar(details) {
    try {
      const pop = await API.getPopular(1);
      if (pop && pop.items) {
        const currentId = details.kinopoiskId || details.filmId;
        const filtered = pop.items.filter(m => (m.kinopoiskId || m.filmId) !== currentId).slice(0, 10);
        if (filtered.length > 0) {
          similarBlock.style.display = 'block';
          similarGrid.innerHTML = filtered.map(m => {
            const mId = m.kinopoiskId || m.filmId;
            const title = m.nameRu || m.nameOriginal || 'Фильм';
            const year = m.year || '';
            const rating = m.ratingKinopoisk || m.rating;
            const poster = m.posterUrlPreview || m.posterUrl || '';
            return `
              <a href="/movie.html?id=${mId}" class="movie-card">
                <div class="poster-container">
                  <img src="${poster}" alt="${title}" loading="lazy">
                  ${rating ? `<div class="rating-badge-card">${parseFloat(rating).toFixed(1)}</div>` : ''}
                </div>
                <div class="movie-info">
                  <div class="movie-title">${title}</div>
                  <div class="movie-year">${year}</div>
                </div>
              </a>
            `;
          }).join('');
        }
      }
    } catch (e) {}
  }
});
