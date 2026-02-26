/* ================================
   CONFIG
================================ */
const TRAKT_ID = 'caae7a3191de89620d5a2f2955ebce640215e6a81b0cc7657b773de5edebfd40';
const TRAKT_SECRET = '35a89bd5967a9151de677fd44a4872ab93efba1cc09fee80c27b9176459ece46';
const TMDB_KEY = '37cc8cb617e62d17e6180754e7a94139';
const REDIRECT_URI = 'https://icream-v.github.io/my-cinema/';

/* ================================
   STATE & CACHE
================================ */
let wasSearchOpen = false; 
const posterCache = {};         
const sectionDataCache = {};

/* ================================
   LOCAL LIBRARY
================================ */

function getLibrary() {
    return JSON.parse(localStorage.getItem('myLibrary')) || {
        movies: {},
        tv: {}
    };
}

function saveLibrary(data) {
    localStorage.setItem('myLibrary', JSON.stringify(data));
}

function isInLibrary(id, type) {
    const lib = getLibrary();
    const key = type === 'movie' ? 'movies' : 'tv';
    return !!lib[key][id];
}

function addToLibrary(id, type, title, poster) {
    const lib = getLibrary();
    const key = type === 'movie' ? 'movies' : 'tv';

    lib[key][id] = {
        id,
        type,
        title,
        poster,
        addedAt: Date.now()
    };

    saveLibrary(lib);
}

function applyLibraryBadge(card, id, type) {
    if (!isInLibrary(id, type)) return;

    if (card.querySelector('.library-badge')) return;

    const badge = document.createElement('div');
    badge.className = 'library-badge';
    badge.textContent = '📚';
    badge.style.position = 'absolute';
    badge.style.top = '6px';
    badge.style.right = '6px';
    badge.style.fontSize = '16px';
    badge.style.background = 'rgba(0,0,0,0.7)';
    badge.style.padding = '4px';
    badge.style.borderRadius = '6px';

    card.style.position = 'relative';
    card.appendChild(badge);
}

function openLibraryView(filter = 'all') {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');

    modal.classList.remove('modal-hidden');
    setScrollLock(true);

    const lib = getLibrary();

    let items = [
        ...Object.values(lib.movies),
        ...Object.values(lib.tv)
    ];

    if (filter === 'movie') {
        items = Object.values(lib.movies);
    }

    if (filter === 'tv') {
        items = Object.values(lib.tv);
    }

    // Sort newest first
    items.sort((a, b) => b.addedAt - a.addedAt);

    body.innerHTML = `
        <h3 style="margin:0 0 10px 10px;">My Library</h3>

        <div style="display:flex; gap:10px; padding:10px;">
            <button class="list-btn" onclick="openLibraryView('all')">All</button>
            <button class="list-btn" onclick="openLibraryView('movie')">Movies</button>
            <button class="list-btn" onclick="openLibraryView('tv')">TV</button>
        </div>

        <div class="grid" id="library-grid"></div>
    `;

   // Inside openLibraryView() after filter buttons
body.innerHTML += `
  <div style="display:flex; gap:10px; padding:10px; border-bottom:1px solid #444; margin-bottom:10px;">
    <button class="list-btn" onclick="exportLibrary()">📤 Export</button>
    <button class="list-btn" onclick="importLibrary()">📥 Import</button>
    <input type="file" id="import-file" style="display:none;" accept=".json">
  </div>
`;

    const grid = document.getElementById('library-grid');

    if (items.length === 0) {
        grid.innerHTML = `<p style="padding:20px; color:gray;">Your library is empty.</p>`;
        return;
    }

    items.forEach(item => {
        renderLibraryCard(item, grid);
    });
}

function exportLibrary() {
    const lib = getLibrary();
    const dataStr = JSON.stringify(lib, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "myLibrary.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert("Library exported as myLibrary.json");
}

function importLibrary() {
    const fileInput = document.getElementById('import-file');
    fileInput.click(); // open file selector

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (data.movies && data.tv) {
                saveLibrary(data); // overwrite current library
                alert("Library imported successfully!");
                openLibraryView(); // refresh modal
            } else {
                alert("Invalid library JSON file.");
            }
        } catch (err) {
            alert("Error reading file: " + err.message);
        }

        fileInput.value = ""; // reset for future imports
    };
}

function renderLibraryCard(item, container) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div class="poster"></div>
        <div class="card-title">${item.title}</div>
    `;

    // Poster image
    if (item.poster) {
        card.querySelector('.poster').outerHTML = `<img class="poster" src="${item.poster}" alt="${item.title}">`;
    }

    // Show details on click
    card.querySelector('.poster').onclick = () => showDetails(item.id, item.type);
    card.querySelector('.card-title').onclick = () => showDetails(item.id, item.type);

    // Trash icon for removal
    const trash = document.createElement('div');
    trash.innerHTML = '🗑️'; // Can replace with other icon if desired
    trash.style.position = 'absolute';
    trash.style.top = '6px';
    trash.style.left = '6px';
    trash.style.fontSize = '16px';
    trash.style.background = 'rgba(0,0,0,0.6)';
    trash.style.padding = '3px';
    trash.style.borderRadius = '4px';
    trash.style.cursor = 'pointer';
    trash.title = 'Remove from Library';

    trash.onclick = (e) => {
        e.stopPropagation(); // Prevent triggering showDetails
        const lib = getLibrary();
        const key = item.type === 'movie' ? 'movies' : 'tv';
        delete lib[key][item.id];
        saveLibrary(lib);
        container.removeChild(card);
    };

    card.style.position = 'relative';
    card.appendChild(trash);

    container.appendChild(card);
}
/* ================================
   INIT & UTILS
================================ */
init();
handleOAuthCallback();
updateAuthUI();

async function init() {
    fetchTrakt('https://api.trakt.tv/movies/trending', 'trending-movies', 'movie', 'Trending Movies');
    fetchTrakt('https://api.trakt.tv/shows/popular', 'popular-shows', 'tv', 'Popular TV Shows');
    fetchTrakt('https://api.trakt.tv/shows/anticipated', 'anticipated', 'tv', 'Most Anticipated');
}

function setScrollLock(lock) {
    document.body.style.overflow = lock ? 'hidden' : '';
    document.body.style.position = lock ? 'fixed' : '';
    document.body.style.width = lock ? '100%' : '';
}

function cleanURL() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

/* ================================
   FETCH & RENDER
================================ */
async function fetchTrakt(url, containerId, type, categoryLabel) {
    try {
        const res = await fetch(url, { headers: { 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID }});
        const data = await res.json();
        const container = document.getElementById(containerId);
        sectionDataCache[containerId] = data;

        data.slice(0, 15).forEach(item => {
            const media = item.movie || item.show || item;
            if (media.ids?.tmdb) renderCard(media.title || media.name, media.ids.tmdb, type, container);
        });

        const seeMore = document.createElement('div');
        seeMore.className = 'card see-more';
        seeMore.innerHTML = `<div class="poster" style="display:flex;align-items:center;justify-content:center;background:#2c2c2e;color:var(--accent);font-weight:bold;">See More</div>`;
        seeMore.onclick = () => openSectionModal(containerId, categoryLabel, type, url);
        container.appendChild(seeMore);
    } catch (err) { console.error(err); }
}

async function renderCard(title, id, type, container) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="poster"></div><div class="card-title">${title}</div>`;
    card.onclick = () => showDetails(id, type);
    container.appendChild(card);

    if (posterCache[id]) {
        card.querySelector('.poster').outerHTML = `<img class="poster" src="${posterCache[id]}" alt="${title}">`;
        return;
    }

    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}`);
        const data = await res.json();
        if (data.poster_path) {
            posterCache[id] = `https://image.tmdb.org/t/p/w342${data.poster_path}`;
            card.querySelector('.poster').outerHTML = `<img class="poster" src="${posterCache[id]}" alt="${title}">`;
        }
    } catch (err) { console.error(err); }
applyLibraryBadge(card, id, type);
}

function refreshLibraryBadges() {
    document.querySelectorAll('.card').forEach(card => {
        const onclick = card.getAttribute('onclick');
        if (!onclick) return;

        const match = onclick.match(/showDetails\((\d+), '(\w+)'\)/);
        if (!match) return;

        const id = match[1];
        const type = match[2];

        applyLibraryBadge(card, id, type);
    });
}

/* ================================
   SEE MORE (DEEP FETCH)
================================ */
async function openSectionModal(containerId, categoryLabel, type, apiUrl) {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    setScrollLock(true);
    modal.classList.remove('modal-hidden');
    
    body.innerHTML = `
        <h3 style="margin:0 0 15px 10px;">${categoryLabel}</h3>
        <div class="grid" id="modal-grid">
            <p style="color:gray; padding:20px;">Deep fetching top 100...</p>
        </div>
    `;

    try {
        const deepUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}limit=100`;
        const res = await fetch(deepUrl, { headers: { 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID }});
        const items = await res.json();
        
        const grid = document.getElementById('modal-grid');
        grid.innerHTML = ''; 

        items.forEach(item => {
            const media = item.movie || item.show || item;
            if (media.ids?.tmdb) renderCard(media.title || media.name, media.ids.tmdb, type, grid);
        });
    } catch (err) { body.querySelector('.grid').innerHTML = '<p>Error loading items.</p>'; }
}

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
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=videos`);
        const data = await res.json();
        const trailer = data.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');

        body.innerHTML = `
            <img class="details-poster" src="https://image.tmdb.org/t/p/w780${data.backdrop_path || data.poster_path}">
            <div class="details-title">${data.title || data.name}</div>
            <div style="color:var(--accent); margin:10px 0;">★ ${data.vote_average?.toFixed(1) || 'N/A'}</div>
            <div class="details-overview">${data.overview || 'No description available.'}</div>
            ${trailer ? `<a href="https://youtube.com/watch?v=${trailer.key}" target="_blank" class="trailer-btn">Watch Trailer</a>` : ''}
            <div style="margin-top:20px;">
                <button class="action-btn" onclick="addToTrakt(${id}, '${type}', '${data.title || data.name}', '${data.poster_path || ''}')">Add to Trakt List</button>
                ${type === 'movie' ? `<button class="action-btn" onclick="addToTMDB(${id}, '${data.title || data.name}', '${data.poster_path || ''}')">Add to TMDB List</button>` : ''}
            </div>
        `;
    } catch (err) { body.innerHTML = '<p>Error.</p>'; }
}

/* ================================
   LIST SELECTOR (METADATA)
================================ */
async function showListSelector(lists, callback) {
    const body = document.getElementById('modal-body');
    body.innerHTML = '<h3>Select List</h3>';
    const tmdbSession = localStorage.getItem('tmdb_session');

    for (const list of lists) {
        const btn = document.createElement('button');
        btn.className = 'list-btn'; 
        let label = list.name;

        if (tmdbSession && list.id && list.item_count !== undefined) {
            try {
                const res = await fetch(`https://api.themoviedb.org/3/list/${list.id}?api_key=${TMDB_KEY}&session_id=${tmdbSession}`);
                const details = await res.json();
                const types = new Set(details.items.map(i => i.media_type));
                let typeLabel = types.size === 1 ? (types.has('movie') ? 'Movies' : 'TV') : 'Mixed';
                label += ` (${typeLabel}, ${details.items.length} items)`;
            } catch (e) { label += ` (${list.item_count} items)`; }
        } 
        else if (list.ids?.slug) {
            if (list.item_count) label += ` (${list.item_count} items)`;
        }

        btn.textContent = label;
        btn.onclick = () => callback(list.ids?.slug || list.id);
        body.appendChild(btn);
    }
}

/* ================================
   AUTHENTICATION & ACTIONS
================================ */
function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('code') && !localStorage.getItem('trakt_token')) exchangeTraktToken(params.get('code'));
    if (params.get('approved') === 'true') createTMDBSession();
}

async function exchangeTraktToken(code) {
    const res = await fetch('https://api.trakt.tv/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, client_id: TRAKT_ID, client_secret: TRAKT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' })
    });
    const data = await res.json();
    if (data.access_token) { localStorage.setItem('trakt_token', data.access_token); updateAuthUI(); cleanURL(); }
}

async function createTMDBSession() {
    const res = await fetch(`https://api.themoviedb.org/3/authentication/session/new?api_key=${TMDB_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_token: localStorage.getItem('tmdb_request_token') })
    });
    const data = await res.json();
    if (data.session_id) { localStorage.setItem('tmdb_session', data.session_id); updateAuthUI(); cleanURL(); }
}

function updateAuthUI() {
    if (localStorage.getItem('trakt_token')) { const b = document.getElementById('login-trakt'); b.textContent = "Trakt ✓"; b.style.background = "#34c759"; b.disabled = true; }
    if (localStorage.getItem('tmdb_session')) { const b = document.getElementById('login-tmdb'); b.textContent = "TMDB ✓"; b.style.background = "#34c759"; b.disabled = true; }
}

function loginTrakt() { window.location.href = `https://api.trakt.tv/oauth/authorize?response_type=code&client_id=${TRAKT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`; }
async function loginTMDB() {
    const res = await fetch(`https://api.themoviedb.org/3/authentication/token/new?api_key=${TMDB_KEY}`);
    const data = await res.json();
    localStorage.setItem('tmdb_request_token', data.request_token);
    window.location.href = `https://www.themoviedb.org/authenticate/${data.request_token}?redirect_to=${encodeURIComponent(REDIRECT_URI)}`;
}

function addToTrakt(id, type, title, posterPath) {
    const token = localStorage.getItem('trakt_token');
    if (!token) { loginTrakt(); return; }
    fetch('https://api.trakt.tv/users/me/lists', { headers: { 'Authorization': `Bearer ${token}`, 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID }})
    .then(r => r.json()).then(lists => showListSelector(lists, async (listId) => {
        await fetch(`https://api.trakt.tv/users/me/lists/${listId}/items`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID, 'Content-Type': 'application/json' },
            body: JSON.stringify({ [type === 'movie' ? 'movies' : 'shows']: [{ ids: { tmdb: id } }] })
        });
        addToLibrary(
    id,
    type,
    title,
    posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : null
);
       refreshLibraryBadges();

alert('Added to Trakt & Library!'); document.getElementById('modal-overlay').classList.add('modal-hidden'); setScrollLock(false);
    }));
}

function addToTMDB(id, title, posterPath) {
    const session = localStorage.getItem('tmdb_session');
    if (!session) { loginTMDB(); return; }
    fetch(`https://api.themoviedb.org/3/account?api_key=${TMDB_KEY}&session_id=${session}`)
    .then(r => r.json()).then(acc => fetch(`https://api.themoviedb.org/3/account/${acc.id}/lists?api_key=${TMDB_KEY}&session_id=${session}`))
    .then(r => r.json()).then(lists => showListSelector(lists.results, async (listId) => {
        await fetch(`https://api.themoviedb.org/3/list/${listId}/add_item?api_key=${TMDB_KEY}&session_id=${session}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ media_id: id })
        });
        addToLibrary(
    id,
    'movie',
    title,
    posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : null
);
refreshLibraryBadges();
alert('Added to TMDB & Library!'); document.getElementById('modal-overlay').classList.add('modal-hidden'); setScrollLock(false);
    }));
}

/* ================================
   CONTROLS & SEARCH
================================ */
document.getElementById('modal-close').onclick = () => {
    document.getElementById('modal-overlay').classList.add('modal-hidden');
    if (wasSearchOpen) { document.getElementById('search-overlay').classList.remove('modal-hidden'); wasSearchOpen = false; }
    else setScrollLock(false);
};

document.getElementById('nav-search').onclick = () => { document.getElementById('search-overlay').classList.remove('modal-hidden'); setScrollLock(true); };
document.getElementById('nav-profile').onclick = () => {openServiceSelector(); };
document.getElementById('nav-library').onclick = openLibraryView;
document.getElementById('search-close').onclick = () => { document.getElementById('search-overlay').classList.add('modal-hidden'); setScrollLock(false); wasSearchOpen = false; };
document.getElementById('login-trakt').onclick = loginTrakt;
document.getElementById('login-tmdb').onclick = loginTMDB;

let searchTimer;
document.getElementById('search-input').oninput = (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        if (query.length < 3) return;
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        const results = document.getElementById('search-results');
        results.innerHTML = '';
        data.results.forEach(item => {
            if (item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv')) {
                if (!posterCache[item.id]) posterCache[item.id] = `https://image.tmdb.org/t/p/w342${item.poster_path}`;
                renderCard(item.title || item.name, item.id, item.media_type, results);
            }
        });
    }, 500);
};

/* ================================
   LISTS SECTION
================================ */

function openServiceSelector() {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');

    modal.classList.remove('modal-hidden');
    setScrollLock(true);

    body.innerHTML = `
        <h3>Select Service</h3>
        <button class="list-btn" onclick="loadTraktLists()">Trakt</button>
        <button class="list-btn" onclick="loadTMDBLists()">TMDB</button>
    `;
}

async function loadTraktLists() {
    const token = localStorage.getItem('trakt_token');
    if (!token) { loginTrakt(); return; }

    const body = document.getElementById('modal-body');
    body.innerHTML = '<h3>Trakt Lists</h3>';

    /* --- System Lists --- */
    const systemLists = [
        { name: "Watchlist", endpoint: "/users/me/watchlist/movies,shows" }
    ];

    systemLists.forEach(list => {
        const btn = document.createElement('button');
        btn.className = 'list-btn';
        btn.textContent = list.name;
        btn.onclick = () => openTraktSystemList(list.endpoint);
        body.appendChild(btn);
    });

    /* --- Custom Lists --- */
    const res = await fetch('https://api.trakt.tv/users/me/lists', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_ID
        }
    });

    const lists = await res.json();

    lists.forEach(list => {
        const btn = document.createElement('button');
        btn.className = 'list-btn';
        btn.textContent = `${list.name} (${list.item_count})`;
        btn.onclick = () => openTraktCustomList(list.ids.slug);
        body.appendChild(btn);
    });
}

async function openTraktSystemList(endpoint) {
    const token = localStorage.getItem('trakt_token');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <h3>Loading...</h3>
        <div class="grid" id="modal-grid"></div>
    `;

    const res = await fetch(`https://api.trakt.tv${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_ID
        }
    });

    const items = await res.json();
    renderTraktItems(items);
}

async function openTraktCustomList(slug) {
    const token = localStorage.getItem('trakt_token');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <h3>Loading...</h3>
        <div class="grid" id="modal-grid"></div>
    `;

    const res = await fetch(
        `https://api.trakt.tv/users/me/lists/${slug}/items`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'trakt-api-version': '2',
                'trakt-api-key': TRAKT_ID
            }
        }
    );

    const items = await res.json();
    renderTraktItems(items);
}

function renderTraktItems(items) {
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '';

    items.forEach(item => {
        const media = item.movie || item.show;
        if (media?.ids?.tmdb) {
            renderCard(
                media.title || media.name,
                media.ids.tmdb,
                item.type || (item.movie ? 'movie' : 'tv'),
                grid
            );
        }
    });
}

async function loadTMDBLists() {
    const session = localStorage.getItem('tmdb_session');
    if (!session) { loginTMDB(); return; }

    const body = document.getElementById('modal-body');
    body.innerHTML = '<h3>TMDB Lists</h3>';

    const accRes = await fetch(
        `https://api.themoviedb.org/3/account?api_key=${TMDB_KEY}&session_id=${session}`
    );
    const account = await accRes.json();

    const res = await fetch(
        `https://api.themoviedb.org/3/account/${account.id}/lists?api_key=${TMDB_KEY}&session_id=${session}`
    );

    const lists = await res.json();

    lists.results.forEach(list => {
        const btn = document.createElement('button');
        btn.className = 'list-btn';
        btn.textContent = `${list.name} (${list.item_count})`;
        btn.onclick = () => openTMDBList(list.id);
        body.appendChild(btn);
    });
}

async function openTMDBList(listId) {
    const session = localStorage.getItem('tmdb_session');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
        <h3>Loading...</h3>
        <div class="grid" id="modal-grid"></div>
    `;

    const res = await fetch(
        `https://api.themoviedb.org/3/list/${listId}?api_key=${TMDB_KEY}&session_id=${session}`
    );

    const data = await res.json();
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '';

    data.items.forEach(item => {
        if (item.media_type === 'movie' || item.media_type === 'tv') {
            renderCard(
                item.title || item.name,
                item.id,
                item.media_type,
                grid
            );
        }
    });
}
