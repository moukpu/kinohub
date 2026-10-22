// KinoHub - Clean, Intuitive Streaming & Downloading UX
document.addEventListener('DOMContentLoaded', () => {
  let currentNav = 'home';
  let genresList = [];
  let currentFilter = {
    genre: '',
    type: 'ALL',
    order: 'RATING',
    page: 1
  };
  
  let currentMovie = null;
  let currentPlayersData = null;
  let currentTorrentsData = null;
  let selectedBalancer = null;
  let selectedTranslation = null;

  // DOM Elements
  const spotlightCard = document.getElementById('spotlightCard');
  const homeSection = document.getElementById('homeSection');
  const popularCarousel = document.getElementById('popularCarousel');
  const top250Carousel = document.getElementById('top250Carousel');
  const seriesCarousel = document.getElementById('seriesCarousel');
  const catalogGrid = document.getElementById('catalogGrid');
  const catalogSection = document.getElementById('catalogSection');
  const searchInput = document.getElementById('searchInput');
  const searchDropdown = document.getElementById('searchDropdown');

  // Modal Elements
  const movieModal = document.getElementById('movieModal');
  const modalClose = document.getElementById('modalClose');
  const playerIframe = document.getElementById('playerIframe');
  const voiceoverSelect = document.getElementById('voiceoverSelect');
  const qualitySelect = document.getElementById('qualitySelect');
  const balancerSelect = document.getElementById('balancerSelect');
  const downloadMp4Btn = document.getElementById('downloadMp4Btn');
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalRatings = document.getElementById('modalRatings');
  const modalMeta = document.getElementById('modalMeta');
  const modalDesc = document.getElementById('modalDesc');

  const downloadModal = document.getElementById('downloadModal');
  const downloadModalClose = document.getElementById('downloadModalClose');
  const dlModalTitle = document.getElementById('dlModalTitle');
  const dlReleasesList = document.getElementById('dlReleasesList');

  // LocalStorage Bookmarks
  function getBookmarks() {
    return JSON.parse(localStorage.getItem('kinohub_bookmarks') || '[]');
  }

  function isBookmarked(id) {
    return getBookmarks().some(b => (b.kinopoiskId || b.filmId) === id);
  }

  function toggleBookmark(movie) {
    let list = getBookmarks();
    const id = movie.kinopoiskId || movie.filmId;
    const exists = list.find(b => (b.kinopoiskId || b.filmId) === id);

    if (exists) {
      list = list.filter(b => (b.kinopoiskId || b.filmId) !== id);
      showToast('Удалено из закладок');
    } else {
      list.unshift(movie);
      showToast('Добавлено в закладки');
    }
    localStorage.setItem('kinohub_bookmarks', JSON.stringify(list));
    updateBookmarkBtn(id);
    if (currentNav === 'bookmarks') {
      renderBookmarksView();
    }
  }

  function updateBookmarkBtn(id) {
    if (isBookmarked(id)) {
      bookmarkBtn.textContent = 'В закладках ✓';
      bookmarkBtn.style.color = 'var(--accent)';
    } else {
      bookmarkBtn.textContent = 'В закладки';
      bookmarkBtn.style.color = '';
    }
  }

  function showToast(text) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function createMovieCard(movie, rank = null) {
    const id = movie.kinopoiskId || movie.filmId;
    const title = movie.nameRu || movie.nameOriginal || movie.nameEn || 'Без названия';
    const year = movie.year || '';
    const rating = movie.ratingKinopoisk || movie.rating;
    const poster = movie.posterUrlPreview || movie.posterUrl || '';
    const genre = movie.genres?.[0]?.genre || '';
    const topRank = rank || movie.topRank;

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
      <div class="card-poster-wrapper">
        <img class="card-poster" src="${poster}" alt="${title}" loading="lazy" />
        ${rating ? `<span class="card-rating">${parseFloat(rating).toFixed(1)}</span>` : ''}
        ${topRank ? `<span class="card-rank">#${topRank}</span>` : ''}
      </div>
      <div class="card-info">
        <div class="card-title" title="${title}">${title}</div>
        <div class="card-meta">
          <span>${year}</span>
          <span style="text-transform: capitalize;">${genre}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openMovieModal(id));
    return card;
  }

  // Load Main Sections
  async function loadHome() {
    homeSection.style.display = 'block';
    catalogSection.style.display = 'none';

    // 1. Popular
    const pop = await API.getPopular(1);
    if (pop.items && pop.items.length > 0) {
      renderSpotlight(pop.items[0]);
      popularCarousel.innerHTML = '';
      pop.items.slice(1).forEach(m => popularCarousel.appendChild(createMovieCard(m)));
    }

    // 2. Top 250
    const top = await API.getTop250(1);
    if (top.items) {
      top250Carousel.innerHTML = '';
      top.items.forEach((m, idx) => top250Carousel.appendChild(createMovieCard(m, idx + 1)));
    }

    // 3. Series
    const ser = await API.getSeries(1);
    if (ser.items) {
      seriesCarousel.innerHTML = '';
      ser.items.forEach(m => seriesCarousel.appendChild(createMovieCard(m)));
    }
  }

  function renderSpotlight(movie) {
    const id = movie.kinopoiskId || movie.filmId;
    const title = movie.nameRu || movie.nameOriginal;
    const year = movie.year || '';
    const rating = movie.ratingKinopoisk || movie.rating;
    const desc = movie.description || '';
    const genres = (movie.genres || []).map(g => g.genre).join(', ');
    const poster = movie.posterUrl || movie.posterUrlPreview || '';

    spotlightCard.innerHTML = `
      <img class="spotlight-poster" src="${poster}" alt="${title}" />
      <div class="spotlight-content">
        <div class="spotlight-label">Сейчас в тренде</div>
        <h1 class="spotlight-title">${title}</h1>
        <div class="spotlight-meta">
          ${rating ? `<span>Кинопоиск: <strong>${parseFloat(rating).toFixed(1)}</strong></span> • ` : ''}
          <span>${year}</span> • 
          <span style="text-transform: capitalize;">${genres}</span>
        </div>
        <p class="spotlight-desc">${desc}</p>
        <div class="spotlight-actions">
          <button class="btn btn-primary" id="spotlightWatchBtn">Смотреть</button>
          <button class="btn btn-secondary" id="spotlightDownloadBtn">Скачать</button>
        </div>
      </div>
    `;
    spotlightCard.style.display = 'flex';

    document.getElementById('spotlightWatchBtn').onclick = () => openMovieModal(id);
    document.getElementById('spotlightDownloadBtn').onclick = () => {
      openMovieModal(id);
      setTimeout(() => downloadMp4Btn.click(), 400);
    };
  }

  async function loadTop250View() {
    homeSection.style.display = 'none';
    spotlightCard.style.display = 'none';
    catalogSection.style.display = 'block';
    document.getElementById('catalogTitle').innerHTML = 'Топ-250 лучших фильмов Кинопоиска <span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">(Все 250 позиций)</span>';
    document.getElementById('filterBar').style.display = 'none';
    catalogGrid.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted); grid-column: 1/-1;">Загрузка списка...</div>';

    const res = await API.getAllTop250();
    catalogGrid.innerHTML = '';
    const items = res.items || [];
    items.forEach((m, i) => {
      catalogGrid.appendChild(createMovieCard(m, m.topRank || i + 1));
    });
  }

  // Catalog View
  async function loadCatalog(type = 'ALL', title = 'Каталог фильмов и сериалов') {
    homeSection.style.display = 'none';
    spotlightCard.style.display = 'none';
    catalogSection.style.display = 'block';
    document.getElementById('catalogTitle').textContent = title;

    currentFilter.type = type;
    currentFilter.page = 1;

    renderCatalogFilters();
    await fetchAndRenderCatalog();
  }

  async function fetchAndRenderCatalog() {
    catalogGrid.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted); grid-column: 1/-1;">Загрузка...</div>';
    
    let res;
    if (currentFilter.type === 'TOP250') {
      res = await API.getTop250(currentFilter.page);
    } else {
      res = await API.getFiltered({
        genreId: currentFilter.genre,
        type: currentFilter.type === 'ALL' ? '' : currentFilter.type,
        order: currentFilter.order,
        page: currentFilter.page
      });
    }

    catalogGrid.innerHTML = '';
    const items = res.items || [];
    if (items.length === 0) {
      catalogGrid.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted); grid-column: 1/-1;">Фильмов не найдено.</div>';
      return;
    }

    items.forEach(m => catalogGrid.appendChild(createMovieCard(m)));
  }

  async function renderCatalogFilters() {
    const genreContainer = document.getElementById('genrePills');
    if (genresList.length === 0) {
      const filters = await API.getFilters();
      genresList = filters.genres || [];
    }

    genreContainer.innerHTML = `<span class="genre-tag ${!currentFilter.genre ? 'active' : ''}" data-id="">Все жанры</span>`;
    genresList.slice(0, 14).forEach(g => {
      const tag = document.createElement('span');
      tag.className = `genre-tag ${currentFilter.genre == g.id ? 'active' : ''}`;
      tag.textContent = g.genre;
      tag.dataset.id = g.id;
      tag.onclick = () => {
        document.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        currentFilter.genre = g.id;
        currentFilter.page = 1;
        fetchAndRenderCatalog();
      };
      genreContainer.appendChild(tag);
    });

    document.getElementById('sortSelect').onchange = (e) => {
      currentFilter.order = e.target.value;
      fetchAndRenderCatalog();
    };
  }

  function renderBookmarksView() {
    homeSection.style.display = 'none';
    spotlightCard.style.display = 'none';
    catalogSection.style.display = 'block';
    document.getElementById('catalogTitle').textContent = 'Закладки';
    document.getElementById('filterBar').style.display = 'none';

    const bookmarks = getBookmarks();
    catalogGrid.innerHTML = '';
    if (bookmarks.length === 0) {
      catalogGrid.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted); grid-column: 1/-1;">У вас пока нет сохранённых фильмов.</div>';
      return;
    }

    bookmarks.forEach(m => catalogGrid.appendChild(createMovieCard(m)));
  }

  // Live Search
  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (!q) {
      searchDropdown.style.display = 'none';
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const res = await API.search(q);
      const items = res.items || [];
      if (items.length === 0) {
        searchDropdown.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Ничего не найдено</div>';
        searchDropdown.style.display = 'block';
        return;
      }

      searchDropdown.innerHTML = '';
      items.slice(0, 8).forEach(item => {
        const id = item.kinopoiskId || item.filmId;
        const row = document.createElement('div');
        row.className = 'search-item';
        const rating = item.ratingKinopoisk || item.rating;
        row.innerHTML = `
          <img class="search-item-poster" src="${item.posterUrlPreview || item.posterUrl || ''}" alt="" />
          <div class="search-item-info">
            <div class="search-item-title">${item.nameRu || item.nameOriginal || 'Фильм'}</div>
            <div class="search-item-meta">
              ${rating ? `<span>${parseFloat(rating).toFixed(1)}</span> • ` : ''}
              <span>${item.year || ''}</span> • 
              <span>${item.genres?.[0]?.genre || ''}</span>
            </div>
          </div>
        `;
        row.onclick = () => {
          searchDropdown.style.display = 'none';
          openMovieModal(id);
        };
        searchDropdown.appendChild(row);
      });
      searchDropdown.style.display = 'block';
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchDropdown.style.display = 'none';
    }
  });

  // Modal Cinema & Controls
  async function openMovieModal(filmId) {
    movieModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    modalTitle.textContent = 'Загрузка...';
    playerIframe.src = '';
    voiceoverSelect.innerHTML = '<option>Загрузка озвучек...</option>';
    balancerSelect.innerHTML = '<option>Загрузка серверов...</option>';
    magnetLinkBtn.style.display = 'none';

    // Parallel fetch
    const [details, players] = await Promise.all([
      API.getDetails(filmId),
      API.getPlayers(filmId)
    ]);

    currentMovie = details;
    currentPlayersData = players;

    const titleRu = details.nameRu || details.nameOriginal || 'Фильм';
    const year = details.year || '';
    const genres = (details.genres || []).map(g => g.genre).join(', ');
    const countries = (details.countries || []).map(c => c.country).join(', ');
    const directors = (details.staff || []).filter(s => s.professionKey === 'DIRECTOR').map(s => s.nameRu).slice(0, 2).join(', ');

    modalTitle.textContent = `${titleRu} (${year})`;
    modalMeta.textContent = `${year} • ${genres} • ${countries}${directors ? ' • Реж: ' + directors : ''}`;
    modalDesc.textContent = details.description || '';

    modalRatings.innerHTML = `
      ${details.ratingKinopoisk ? `<span class="rating-pill">Кинопоиск ${details.ratingKinopoisk}</span>` : ''}
      ${details.ratingImdb ? `<span class="rating-pill" style="background:#f59e0b; color:#000;">IMDb ${details.ratingImdb}</span>` : ''}
    `;

    updateBookmarkBtn(filmId);
    bookmarkBtn.onclick = () => toggleBookmark(details);

    // Setup Balancers & Voiceovers dropdowns
    setupControls(players);

    // Fetch torrent releases in background
    API.getTorrents(filmId, titleRu, details.nameOriginal, year).then(torrents => {
      currentTorrentsData = torrents;
    });
  }

  function setupControls(playersData) {
    const balancers = playersData.balancers || [];
    balancerSelect.innerHTML = '';
    voiceoverSelect.innerHTML = '';

    if (balancers.length === 0) {
      voiceoverSelect.innerHTML = '<option>Нет доступных плееров</option>';
      return;
    }

    balancers.forEach((b, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${b.name} (Сервер ${idx + 1})`;
      balancerSelect.appendChild(opt);
    });

    balancerSelect.onchange = () => {
      const idx = parseInt(balancerSelect.value, 10);
      switchBalancer(balancers[idx]);
    };

    switchBalancer(balancers[0]);
  }

  function switchBalancer(balancer) {
    selectedBalancer = balancer;
    voiceoverSelect.innerHTML = '';
    const translations = balancer.translations || [];

    if (translations.length > 0) {
      translations.forEach((t, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${t.name} (${t.quality || 'Auto'})`;
        voiceoverSelect.appendChild(opt);
      });

      voiceoverSelect.onchange = () => {
        const idx = parseInt(voiceoverSelect.value, 10);
        switchTranslation(translations[idx]);
      };

      switchTranslation(translations[0]);
    } else {
      voiceoverSelect.innerHTML = '<option>Стандартная дорожка</option>';
      playerIframe.src = balancer.defaultIframe;
    }
  }

  function switchTranslation(translation) {
    selectedTranslation = translation;
    playerIframe.src = translation.iframeUrl;
  }

  // DOWNLOAD BUTTON & MODAL LOGIC
  async function openDownloadModal() {
    if (!currentMovie) return;
    const filmId = currentMovie.kinopoiskId || currentMovie.filmId;
    const titleRu = currentMovie.nameRu || '';
    const titleEn = currentMovie.nameOriginal || currentMovie.nameEn || '';
    const year = currentMovie.year || '';

    dlModalTitle.textContent = `Скачать: ${titleRu || titleEn} (${year})`;
    downloadModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    dlReleasesList.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);">Поиск доступных раздач...</div>';

    let torrents = currentTorrentsData;
    if (!torrents || !torrents.items || torrents.items.length === 0) {
      torrents = await API.getTorrents(filmId, titleRu, titleEn, year);
      currentTorrentsData = torrents;
    }

    if (!torrents || !torrents.items || torrents.items.length === 0) {
      dlReleasesList.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
          Прямых раздач для этого релиза не найдено. Вы можете смотреть фильм онлайн прямо в плеере выше.
        </div>
      `;
      return;
    }

    dlReleasesList.innerHTML = torrents.items.slice(0, 30).map(t => {
      const downloadFileUrl = `/api/torrents/download/${t.id}?name=${encodeURIComponent(t.title)}`;
      return `
        <div class="dl-release-card">
          <div class="dl-card-info">
            <div class="dl-card-title">${t.title}</div>
            <div class="dl-card-meta">
              <span class="dl-badge">${t.quality}</span>
              <span class="dl-badge">${t.voice}</span>
              <span>📁 ${t.size}</span>
              <span style="color: #16a34a; font-weight: 600;">🟢 ${t.seeds}</span>
            </div>
          </div>
          <div class="dl-card-actions">
            <a href="${downloadFileUrl}" class="dl-btn dl-btn-file" title="Скачать файл">
              ⬇ Скачать файл
            </a>
            <a href="${t.magnet}" class="dl-btn dl-btn-magnet" title="Открыть в торрент-клиенте">
              🧲 Magnet
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  downloadMp4Btn.onclick = () => {
    openDownloadModal();
  };

  downloadModalClose.onclick = () => {
    downloadModal.style.display = 'none';
    if (movieModal.style.display === 'flex') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  };

  downloadModal.onclick = (e) => {
    if (e.target === downloadModal) downloadModalClose.click();
  };

  modalClose.onclick = () => {
    movieModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    playerIframe.src = '';
  };

  movieModal.onclick = (e) => {
    if (e.target === movieModal) modalClose.click();
  };

  // Nav Links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const target = link.dataset.nav;
      currentNav = target;

      if (target === 'home') {
        loadHome();
      } else if (target === 'films') {
        loadCatalog('FILM', 'Все фильмы');
      } else if (target === 'series') {
        loadCatalog('TV_SERIES', 'Все сериалы');
      } else if (target === 'top250') {
        loadTop250View();
      } else if (target === 'bookmarks') {
        renderBookmarksView();
      }
    });
  });

  const viewAllBtn = document.getElementById('viewAllTop250Btn');
  if (viewAllBtn) {
    viewAllBtn.onclick = () => {
      const topLink = document.querySelector('[data-nav="top250"]');
      if (topLink) topLink.click();
    };
  }

  // Init
  loadHome();
});
