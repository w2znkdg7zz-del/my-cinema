const TRAKT_ID = 'caae7a3191de89620d5a2f2955ebce640215e6a81b0cc7657b773de5edebfd40';
const TRAKT_SECRET = '35a89bd5967a9151de677fd44a4872ab93efba1cc09fee80c27b9176459ece46';
const TMDB_KEY = '37cc8cb617e62d17e6180754e7a94139';
const REDIRECT_URI = 'https://icream-v.github.io/my-cinema/';

let wasSearchOpen = false;
let currentPage = 1;
const posterCache = {};

// --- Initialization ---
init();
setupBackToTop();
setupSearch();

async function init() {
    fetchTrakt('https://api.trakt.tv/movies/trending', 'trending-movies', 'movie', 'Trending Movies');
    fetchTrakt('https://api.trakt.tv/shows/popular', 'popular-shows', 'tv', 'Popular TV Shows');
    fetchTrakt('https://api.trakt.tv/shows/anticipated', 'anticipated', 'tv', 'Most Anticipated');
}

// --- Scroll & Top Button Logic ---
function setupBackToTop() {
    const btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.innerHTML = '↑';
    document.body.appendChild(btn);
    btn.onclick = () => {
        const active = document.querySelector('#modal-grid, #search-results');
        if (active) active.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function handleScroll(e) {
    const btn = document.getElementById('back-to-top');
    btn.style.display = e.target.scrollTop > 400 ? 'flex' : 'none';
}

function setScrollLock(lock) {
    document.body.style.overflow = lock ? 'hidden' : '';
    document.body.style.position = lock ? 'fixed' : '';
    document.body.style.width = lock ? '100%' : '';
}

// --- Search Logic ---
function setupSearch() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');
    let timer;

    input.oninput = (e) => {
        const val = e.target.value.trim();
        clearBtn.style.display = val.length > 0 ? 'block' : 'none';
        clearTimeout(timer);
        timer = setTimeout(async () => {
            if (val.length < 3) return;
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(val)}`);
            const data = await res.json();
            const results = document.getElementById('search-results');
            results.innerHTML = '';
            results.addEventListener('scroll', handleScroll);
            data.results.forEach(item => {
                if (item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv')) {
                    renderCard(item.title || item.name, item.id, item.media_type, results);
                }
            });
        }, 500);
    };

    clearBtn.onclick = () => {
        input.value = '';
        document.getElementById('search-results').innerHTML = '';
        clearBtn.style.display = 'none';
        input.focus();
    };
}

// --- Fetch & Render ---
async function fetchTrakt(url, containerId, type, label) {
    const res = await fetch(url, { headers: { 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID }});
    const data = await res.json();
    const container = document.getElementById(containerId);
    data.slice(0, 15).forEach(item => {
        const media = item.movie || item.show || item;
        renderCard(media.title || media.name, media.ids.tmdb, type, container);
    });
    // Add "See More" Card
    const seeMore = document.createElement('div');
    seeMore.className = 'card see-more';
    seeMore.innerHTML = `<div class="poster" style="display:flex;align-items:center;justify-content:center;color:var(--accent);">See More</div>`;
    seeMore.onclick = () => openSectionModal(label, type, url);
    container.appendChild(seeMore);
}

async function renderCard(title, id, type, container) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="poster"></div><div class="card-title">${title}</div>`;
    card.onclick = () => showDetails(id, type);
    container.appendChild(card);
    if (posterCache[id]) {
        card.querySelector('.poster').outerHTML = `<img class="poster" src="${posterCache[id]}">`;
    } else {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}`);
        const data = await res.json();
        if (data.poster_path) {
            posterCache[id] = `https://image.tmdb.org/t/p/w185${data.poster_path}`;
            card.querySelector('.poster').outerHTML = `<img class="poster" src="${posterCache[id]}">`;
        }
    }
}

// --- Modals & Pagination ---
async function openSectionModal(label, type, apiUrl) {
    currentPage = 1;
    setScrollLock(true);
    document.getElementById('modal-overlay').classList.remove('modal-hidden');
    document.getElementById('modal-body').innerHTML = `<h3>${label}</h3><div class="grid" id="modal-grid"></div>`;
    const grid = document.getElementById('modal-grid');
    grid.addEventListener('scroll', handleScroll);
    loadNextPage(apiUrl, type, grid);
}

async function loadNextPage(apiUrl, type, grid) {
    const oldBtn = grid.querySelector('.load-more-btn');
    if (oldBtn) oldBtn.remove();
    const url = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}limit=40&page=${currentPage}`;
    const res = await fetch(url, { headers: { 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID }});
    const items = await res.json();
    items.forEach(item => {
        const media = item.movie || item.show || item;
        renderCard(media.title || media.name, media.ids.tmdb, type, grid);
    });
    const moreBtn = document.createElement('button');
    moreBtn.className = 'load-more-btn';
    moreBtn.textContent = `Load Page ${currentPage + 1}`;
    moreBtn.onclick = () => { currentPage++; loadNextPage(apiUrl, type, grid); };
    grid.appendChild(moreBtn);
}

async function showDetails(id, type) {
    const search = document.getElementById('search-overlay');
    wasSearchOpen = !search.classList.contains('modal-hidden');
    if (wasSearchOpen) search.classList.add('modal-hidden');
    
    document.getElementById('modal-overlay').classList.remove('modal-hidden');
    setScrollLock(true);
    const body = document.getElementById('modal-body');
    body.innerHTML = 'Loading...';
    
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=videos`);
    const data = await res.json();
    const trailer = data.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    
    body.innerHTML = `
        <img class="details-poster" src="https://image.tmdb.org/t/p/w780${data.backdrop_path || data.poster_path}">
        <div class="details-title">${data.title || data.name}</div>
        <div class="details-overview">${data.overview}</div>
        ${trailer ? `<a href="https://youtube.com/watch?v=${trailer.key}" target="_blank" class="trailer-btn">Watch Trailer</a>` : ''}
    `;
}

// --- Close Controls ---
document.getElementById('modal-close').onclick = () => {
    document.getElementById('modal-overlay').classList.add('modal-hidden');
    document.getElementById('back-to-top').style.display = 'none';
    if (wasSearchOpen) {
        document.getElementById('search-overlay').classList.remove('modal-hidden');
        wasSearchOpen = false;
    } else setScrollLock(false);
};

document.getElementById('search-close').onclick = () => {
    document.getElementById('search-overlay').classList.add('modal-hidden');
    document.getElementById('back-to-top').style.display = 'none';
    setScrollLock(false);
};

document.getElementById('nav-search').onclick = () => {
    document.getElementById('search-overlay').classList.remove('modal-hidden');
    setScrollLock(true);
};
