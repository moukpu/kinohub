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
  if (headerSearchBtn) headerSearchBtn.onclick = doSearch;
  if (headerSearchInput) {
    headerSearchInput.onkeydown = (e) => {
      if (e.key === 'Enter') doSearch();
    };
  }

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

  // Direct Download Elements
  const dlQualitySelect = document.getElementById('dlQualitySelect');
  const dlVoiceSelect = document.getElementById('dlVoiceSelect');
  const startDownloadBtn = document.getElementById('startDownloadBtn');
  const dlStatusBox = document.getElementById('dlStatusBox');
  const dlStatusMsg = document.getElementById('dlStatusMsg');

  // Similar Movies Elements
  const similarBlock = document.getElementById('similarBlock');
  const similarGrid = document.getElementById('similarGrid');

  let currentMovie = null;
  let currentPlayers = [];
  let currentActiveBalancer = null;

  // Toast notification
  function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // Bookmarks Storage
  function getBookmarks() {
    return JSON.parse(localStorage.getItem('kinohub_bookmarks') || '[]');
  }
  function isBookmarked(id) {
    return getBookmarks().some(m => String(m.kinopoiskId || m.filmId) === String(id));
  }
  function updateBookmarkBtn(id) {
    if (!heroBookmarkBtn) return;
    if (isBookmarked(id)) {
      heroBookmarkBtn.innerHTML = '★ В закладках';
      heroBookmarkBtn.classList.add('btn-bookmarked');
    } else {
      heroBookmarkBtn.innerHTML = '🔖 В закладки';
      heroBookmarkBtn.classList.remove('btn-bookmarked');
    }
  }
  if (heroBookmarkBtn) {
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
  }

  // 1. Fetch Movie Details
  try {
    const details = await API.getDetails(filmId);
    if (!details || details.error) {
      if (movieTitleRu) movieTitleRu.textContent = 'Ошибка загрузки информации о фильме';
      return;
    }

    currentMovie = details;
    const titleRu = details.nameRu || details.nameOriginal || 'Без названия';
    const titleEn = details.nameOriginal || details.nameEn || '';
    const year = details.year || '';
    const poster = details.posterUrl || details.posterUrlPreview || '';

    document.title = `${titleRu} (${year}) смотреть онлайн и скачать — КиноХаб`;

    // Breadcrumbs
    if (bcCategory) bcCategory.textContent = details.type === 'TV_SERIES' ? 'Сериалы' : 'Фильмы';
    if (bcTitle) bcTitle.textContent = `${titleRu} (${year})`;

    // Hero
    if (moviePoster) {
      moviePoster.src = poster;
      moviePoster.alt = titleRu;
    }

    if (movieAgeBadge) {
      if (details.ratingAgeLimits) {
        const ageNum = details.ratingAgeLimits.replace('age', '');
        movieAgeBadge.textContent = `${ageNum}+`;
        movieAgeBadge.style.display = 'block';
      } else {
        movieAgeBadge.style.display = 'none';
      }
    }

    if (movieTitleRu) movieTitleRu.textContent = titleRu;
    if (movieTitleOrig) movieTitleOrig.textContent = titleEn ? `${titleEn} (${year})` : year;

    // Ratings
    if (movieRatings) {
      let ratingsHtml = '';
      const kpRating = details.ratingKinopoisk || details.rating;
      if (kpRating) {
        ratingsHtml += `<div class="rating-badge rating-kp">⭐ Кинопоиск: <strong>${parseFloat(kpRating).toFixed(1)}</strong></div>`;
      }
      if (details.ratingImdb) {
        ratingsHtml += `<div class="rating-badge rating-imdb">IMDb: <strong>${parseFloat(details.ratingImdb).toFixed(1)}</strong></div>`;
      }
      movieRatings.innerHTML = ratingsHtml;
    }

    // Specs
    if (specYear) specYear.textContent = year || '—';
    if (specCountry) specCountry.textContent = (details.countries || []).map(c => c.country).join(', ') || '—';
    if (specGenre) specGenre.textContent = (details.genres || []).map(g => g.genre).join(', ') || '—';
    
    const sloganRow = document.getElementById('rowSlogan');
    if (sloganRow) {
      if (details.slogan) {
        if (specSlogan) specSlogan.textContent = `«${details.slogan}»`;
        sloganRow.style.display = '';
      } else {
        sloganRow.style.display = 'none';
      }
    }

    const durationRow = document.getElementById('rowDuration');
    if (durationRow) {
      if (details.filmLength) {
        const mins = details.filmLength;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (specDuration) specDuration.textContent = h > 0 ? `${mins} мин. (${h} ч ${m} мин)` : `${mins} мин.`;
        durationRow.style.display = '';
      } else {
        durationRow.style.display = 'none';
      }
    }

    if (movieDescription) {
      movieDescription.textContent = details.description || details.shortDescription || 'Описание фильма пока отсутствует.';
    }
    updateBookmarkBtn(filmId);

    // 2. Load Players & Setup Download
    loadPlayersAndDownloads(filmId, details);

    // 3. Load Similar Movies
    loadSimilar(details);

  } catch (err) {
    console.error('Error loading movie page:', err);
    if (movieTitleRu) movieTitleRu.textContent = 'Ошибка загрузки данных';
  }

  // Setup Players and Downloads
  async function loadPlayersAndDownloads(id, details) {
    let balancers = [];
    let directStream = null;

    try {
      const playersData = await API.getPlayers(id, details.nameRu);
      if (playersData) {
        balancers = playersData.balancers ? [...playersData.balancers] : [];
        directStream = playersData.directStream || null;
      }
    } catch (e) {
      console.warn('API getPlayers failed, using fallback:', e);
    }

    // Ensure Collaps is always present
    if (!balancers.some(b => b.name.toLowerCase().includes('collaps'))) {
      balancers.unshift({
        name: 'Collaps',
        defaultIframe: `https://api.nextembed.ws/embed/movie/${id}`,
        translations: [
          { name: 'Основная озвучка (1080p)', quality: '1080p', iframeUrl: `https://api.nextembed.ws/embed/movie/${id}` }
        ]
      });
    }

    // Ensure Veoveo fallback
    if (!balancers.some(b => b.name.toLowerCase().includes('veoveo'))) {
      balancers.push({
        name: 'Veoveo',
        defaultIframe: `https://player.shortener2.link/balancer-api/iframe?movie_id=15652`,
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

    // Render Server Tabs
    if (serverTabsList) {
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
    }

    // Setup Direct Download Section
    setupDownloadSection(id, details, balancers, directStream);
  }

  function switchServer(balancer, tabBtn) {
    currentActiveBalancer = balancer;
    document.querySelectorAll('.server-tab').forEach(t => t.classList.remove('active'));
    if (tabBtn) tabBtn.classList.add('active');

    // Handle translations / voiceovers
    if (balancer.translations && balancer.translations.length > 1) {
      if (playerOptionsBar) playerOptionsBar.style.display = 'flex';
      if (movieVoiceoverSelect) {
        movieVoiceoverSelect.innerHTML = balancer.translations.map(t => 
          `<option value="${t.iframeUrl}">${t.name} (${t.quality || 'HD'})</option>`
        ).join('');

        movieVoiceoverSelect.onchange = () => {
          if (cinemaIframe) cinemaIframe.src = movieVoiceoverSelect.value;
        };
      }
      if (cinemaIframe) cinemaIframe.src = balancer.translations[0].iframeUrl;
    } else {
      if (playerOptionsBar) playerOptionsBar.style.display = 'none';
      if (cinemaIframe) cinemaIframe.src = balancer.defaultIframe;
    }
  }

  if (reloadPlayerBtn) {
    reloadPlayerBtn.onclick = () => {
      if (cinemaIframe && cinemaIframe.src) {
        const cur = cinemaIframe.src;
        cinemaIframe.src = '';
        setTimeout(() => { cinemaIframe.src = cur; }, 100);
        showToast('Плеер перезагружается...');
      }
    };
  }

  // Setup Direct Video Download
  function setupDownloadSection(id, details, balancers, directStream) {
    if (!startDownloadBtn || !dlVoiceSelect || !dlQualitySelect) return;

    const voiceList = [];
    if (directStream && Array.isArray(directStream.audios) && directStream.audios.length > 0) {
      directStream.audios.forEach(v => {
        if (v && !voiceList.includes(v)) voiceList.push(v);
      });
    }

    balancers.forEach(b => {
      (b.translations || []).forEach(t => {
        if (t && t.name && !voiceList.includes(t.name)) {
          voiceList.push(t.name);
        }
      });
    });

    if (voiceList.length > 0) {
      dlVoiceSelect.innerHTML = voiceList.map((v, idx) => 
        `<option value="${encodeURIComponent(v)}" ${idx === 0 ? 'selected' : ''}>${v}</option>`
      ).join('');
    } else {
      dlVoiceSelect.innerHTML = '<option value="default" selected>Основная озвучка (Дубляж / Проф.)</option>';
    }

    startDownloadBtn.onclick = () => {
      const quality = dlQualitySelect.value;
      const voiceRaw = dlVoiceSelect.value;
      const voiceName = voiceRaw === 'default' ? 'Дубляж' : decodeURIComponent(voiceRaw);
      const title = details.nameRu || details.nameOriginal || 'movie';
      
      if (dlStatusBox && dlStatusMsg) {
        dlStatusBox.style.display = 'flex';
        dlStatusMsg.textContent = `Загрузка «${title}» (${quality}, ${voiceName})...`;
      }

      // Generate direct download URL
      const downloadUrl = `/api/movies/${id}/download-mp4?quality=${quality}&voice=${encodeURIComponent(voiceName)}&title=${encodeURIComponent(title)}`;
      
      // Native browser file download: creates an invisible anchor with download attribute and clicks it
      // This immediately instructs the browser to trigger a file save dialog or background download without opening a video player page
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${title}_${quality}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      showToast(`Началось скачивание «${title} (${quality})»`);

      setTimeout(() => {
        if (dlStatusMsg) dlStatusMsg.textContent = `Загрузка начата! Если файл не появился, проверьте загрузки браузера.`;
      }, 1800);

      setTimeout(() => {
        if (dlStatusBox) dlStatusBox.style.display = 'none';
      }, 8000);
    };
  }

  // Setup Similar Movies
  async function loadSimilar(details) {
    if (!similarBlock || !similarGrid) return;
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
