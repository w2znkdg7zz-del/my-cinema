/* ================================
   CONFIG
================================ */
const TRAKT_ID = 'YOUR_TRAKT_ID';
const TRAKT_SECRET = 'YOUR_TRAKT_SECRET';
const TMDB_KEY = 'YOUR_TMDB_KEY';
const REDIRECT_URI = 'https://icream-v.github.io/my-cinema/';

/* ================================
   STATE & CACHE
================================ */
let wasSearchOpen = false;
let scrollY = 0;
const posterCache = {};
const sectionDataCache = {};

/* ================================
   INIT
================================ */
init();
handleOAuthCallback();
updateAuthUI();

async function init() {
    fetchTrakt('https://api.trakt.tv/movies/trending', 'trending-movies', 'movie', 'Trending Movies');
    fetchTrakt('https://api.trakt.tv/shows/popular', 'popular-shows', 'tv', 'Popular TV Shows');
    fetchTrakt('https://api.trakt.tv/shows/anticipated', 'anticipated', 'tv', 'Most Anticipated');
}

/* ================================
   SCROLL LOCK FIX
================================ */
function setScrollLock(lock) {
    if (lock) {
        scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
    } else {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
    }
}

/* ================================
   FETCH TRAKT SECTIONS
================================ */
async function fetchTrakt(url, containerId, type, categoryLabel) {
    try {
        const res = await fetch(url, {
            headers: {
                'trakt-api-version': '2',
                'trakt-api-key': TRAKT_ID
            }
        });

        const data = await res.json();
        const container = document.getElementById(containerId);
        sectionDataCache[containerId] = data;

        data.slice(0, 15).forEach(item => {
            const media = item.movie || item.show || item;
            if (media.ids?.tmdb) {
                renderCard(media.title || media.name, media.ids.tmdb, type, container);
            }
        });

        const seeMore = document.createElement('div');
        seeMore.className = 'card see-more';
        seeMore.innerHTML = `<div class="poster">See More</div>`;
        seeMore.onclick = () => openSectionModal(containerId, categoryLabel, type, url);
        container.appendChild(seeMore);

    } catch (err) {
        console.error(err);
    }
}

/* ================================
   RENDER CARD (FIXED)
================================ */
async function renderCard(title, id, type, container) {
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => showDetails(id, type);

    if (posterCache[id]) {
        card.innerHTML = `
            <img class="poster" src="${posterCache[id]}" alt="${title}">
            <div class="card-title">${title}</div>
        `;
        container.appendChild(card);
        return;
    }

    card.innerHTML = `
        <div class="poster"></div>
        <div class="card-title">${title}</div>
    `;
    container.appendChild(card);

    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}`);
        const data = await res.json();
        if (data.poster_path) {
            posterCache[id] = `https://image.tmdb.org/t/p/w342${data.poster_path}`;
            card.querySelector('.poster').outerHTML =
                `<img class="poster" src="${posterCache[id]}" alt="${title}">`;
        }
    } catch (err) {
        console.error(err);
    }
}

/* ================================
   CONCURRENCY LIMITER
================================ */
async function limitedMap(array, limit, asyncFn) {
    const results = [];
    const executing = [];

    for (const item of array) {
        const p = Promise.resolve().then(() => asyncFn(item));
        results.push(p);

        if (limit <= array.length) {
            const e = p.then(() =>
                executing.splice(executing.indexOf(e), 1)
            );
            executing.push(e);
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }

    return Promise.all(results);
}

/* ================================
   SEE MORE MODAL (WITH LOAD MORE)
================================ */
async function openSectionModal(containerId, categoryLabel, type, apiUrl) {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');

    setScrollLock(true);
    modal.classList.remove('modal-hidden');

    body.innerHTML = `
        <h3 style="margin:0 0 15px 10px;">${categoryLabel}</h3>
        <div class="grid" id="modal-grid"></div>
    `;

    const grid = document.getElementById('modal-grid');

    try {
        const deepUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}limit=100`;
        const res = await fetch(deepUrl, {
            headers: {
                'trakt-api-version': '2',
                'trakt-api-key': TRAKT_ID
            }
        });

        const items = await res.json();
        let visibleCount = 0;
        const batchSize = 24;

        async function renderBatch() {
            const slice = items.slice(visibleCount, visibleCount + batchSize);

            await limitedMap(slice, 5, async (item) => {
                const media = item.movie || item.show || item;
                if (media.ids?.tmdb) {
                    await renderCard(
                        media.title || media.name,
                        media.ids.tmdb,
                        type,
                        grid
                    );
                }
            });

            visibleCount += batchSize;

            if (visibleCount < items.length) {
                addLoadMoreCard();
            }
        }

        function addLoadMoreCard() {
            const loadCard = document.createElement('div');
            loadCard.className = 'card see-more';
            loadCard.innerHTML = `<div class="poster">Load More</div>`;
            loadCard.onclick = () => {
                loadCard.remove();
                renderBatch();
            };
            grid.appendChild(loadCard);
        }

        renderBatch();

    } catch (err) {
        grid.innerHTML = '<p>Error loading items.</p>';
    }
}

/* ================================
   SHOW DETAILS
================================ */
async function showDetails(id, type) {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    const searchOverlay = document.getElementById('search-overlay');

    wasSearchOpen = !searchOverlay.classList.contains('modal-hidden');
    if (wasSearchOpen) searchOverlay.classList.add('modal-hidden');

    modal.classList.remove('modal-hidden');
    setScrollLock(true);
    body.innerHTML = '<p style="text-align:center; padding-top:50px;">Loading...</p>';

    try {
        const res = await fetch(
            `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=videos`
        );

        const data = await res.json();
        const trailer = data.videos?.results.find(
            v => v.type === 'Trailer' && v.site === 'YouTube'
        );

        body.innerHTML = `
            <img class="details-poster" src="https://image.tmdb.org/t/p/w780${data.backdrop_path || data.poster_path}">
            <div class="details-title">${data.title || data.name}</div>
            <div style="color:var(--accent); margin:10px 0;">★ ${data.vote_average?.toFixed(1) || 'N/A'}</div>
            <div class="details-overview">${data.overview || 'No description available.'}</div>
            ${trailer ? `<a href="https://youtube.com/watch?v=${trailer.key}" target="_blank" class="trailer-btn">Watch Trailer</a>` : ''}
            <div style="margin-top:20px;">
                <button class="action-btn" id="trakt-btn">Add to Trakt List</button>
                ${type === 'movie' ? `<button class="action-btn" id="tmdb-btn">Add to TMDB List</button>` : ''}
            </div>
        `;

        document.getElementById('trakt-btn').onclick = async (e) => {
            e.target.disabled = true;
            await addToTrakt(id, type);
        };

        const tmdbBtn = document.getElementById('tmdb-btn');
        if (tmdbBtn) {
            tmdbBtn.onclick = async (e) => {
                e.target.disabled = true;
                await addToTMDB(id);
            };
        }

    } catch (err) {
        body.innerHTML = '<p>Error loading details.</p>';
    }
}

/* ================================
   SEARCH (FIXED)
================================ */
let searchTimer;

document.getElementById('search-input').oninput = (e) => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        const results = document.getElementById('search-results');

        if (query.length < 3) {
            results.innerHTML = '';
            return;
        }

        const res = await fetch(
            `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`
        );

        const data = await res.json();
        results.innerHTML = '';

        data.results.forEach(item => {
            if (
                item.poster_path &&
                (item.media_type === 'movie' || item.media_type === 'tv')
            ) {
                if (!posterCache[item.id]) {
                    posterCache[item.id] =
                        `https://image.tmdb.org/t/p/w342${item.poster_path}`;
                }

                renderCard(
                    item.title || item.name,
                    item.id,
                    item.media_type,
                    results
                );
            }
        });

    }, 400);
};

/* ================================
   MODAL CONTROLS
================================ */
document.getElementById('modal-close').onclick = () => {
    document.getElementById('modal-overlay').classList.add('modal-hidden');
    setScrollLock(false);
};

document.getElementById('nav-search').onclick = () => {
    document.getElementById('search-overlay').classList.remove('modal-hidden');
    setScrollLock(true);
};

document.getElementById('search-close').onclick = () => {
    document.getElementById('search-overlay').classList.add('modal-hidden');
    setScrollLock(false);
};
