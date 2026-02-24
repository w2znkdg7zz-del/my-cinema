/* ================================
   CONFIG
================================ */
const TRAKT_ID = 'caae7a3191de89620d5a2f2955ebce640215e6a81b0cc7657b773de5edebfd40';
const TRAKT_SECRET = '35a89bd5967a9151de677fd44a4872ab93efba1cc09fee80c27b9176459ece46';
const TMDB_KEY = 'e2b666343235c45fc18f12f2f256c29e5bb5977bc6ca9ca8d6a5bef7a7d6778f';
const REDIRECT_URI = 'https://w2znkdg7zz-del.github.io/my-cinema/';

/* ================================
   STATE
================================ */
let pendingAction = null;

/* ================================
   INIT
================================ */
init();
handleOAuthCallback();

async function init() {
    fetchTrakt('https://api.trakt.tv/movies/trending', 'trending-movies', 'movie');
    fetchTrakt('https://api.trakt.tv/shows/popular', 'popular-shows', 'tv');
    fetchTrakt('https://api.trakt.tv/shows/anticipated', 'anticipated', 'tv');
}

/* ================================
   TRKT FETCH & RENDER
================================ */
async function fetchTrakt(url, containerId, type) {
    try {
        const res = await fetch(url, { 
            headers: { 
                'trakt-api-version': '2', 
                'trakt-api-key': TRAKT_ID 
            }
        });
        const data = await res.json();
        const container = document.getElementById(containerId);
        
        data.slice(0, 15).forEach(item => {
            const media = item.movie || item.show || item;
            if (media.ids && media.ids.tmdb) {
                renderCard(media.title || media.name, media.ids.tmdb, type, container);
            }
        });
    } catch (err) {
        console.error("Error fetching Trakt data:", err);
    }
}

async function renderCard(title, id, type, container) {
    if (!id) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="poster"></div><div class="card-title">${title}</div>`;
    card.onclick = () => showDetails(id, type);
    container.appendChild(card);

    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}`);
        const data = await res.json();
        if (data.poster_path) {
            const posterDiv = card.querySelector('.poster');
            posterDiv.outerHTML = `<img class="poster" src="https://image.tmdb.org/t/p/w342${data.poster_path}" alt="${title}">`;
        }
    } catch (err) {
        console.error("Error fetching poster:", err);
    }
}

/* ================================
   SHOW DETAILS MODAL
================================ */
async function showDetails(id, type) {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    modal.classList.remove('modal-hidden');
    body.innerHTML = '<p style="text-align:center; padding-top:50px;">Loading...</p>';

    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=videos`);
        const data = await res.json();
        const trailer = data.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');

        body.innerHTML = `
            <img class="details-poster" src="https://image.tmdb.org/t/p/w780${data.backdrop_path || data.poster_path}">
            <div class="details-title">${data.title || data.name}</div>
            <div style="color:var(--accent); margin:10px 0;">★ ${data.vote_average ? data.vote_average.toFixed(1) : 'N/A'}</div>
            <div class="details-overview">${data.overview || 'No description available.'}</div>

            ${trailer ? `<a href="https://youtube.com/watch?v=${trailer.key}" target="_blank" class="trailer-btn">Watch Trailer</a>` : ''}

            <div style="margin-top:20px;">
                <button class="action-btn" onclick="addToTrakt(${id}, '${type}')">Add to Trakt List</button>
                ${type === 'movie' ? `<button class="action-btn" onclick="addToTMDB(${id})">Add to TMDB List</button>` : ''}
            </div>
        `;
    } catch (err) {
        body.innerHTML = '<p>Error loading details.</p>';
    }
}

/* ================================
   OAUTH HANDLING
================================ */
function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const tmdbApproved = params.get('approved');

    if (code && !localStorage.getItem('trakt_token')) {
        exchangeTraktToken(code);
    }

    if (tmdbApproved === 'true') {
        createTMDBSession();
    }
}

async function exchangeTraktToken(code) {
    const res = await fetch('https://api.trakt.tv/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code,
            client_id: TRAKT_ID,
            client_secret: TRAKT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    });

    const data = await res.json();
    localStorage.setItem('trakt_token', data.access_token);
    cleanURL();
    retryPendingAction();
}

function loginTrakt() {
    window.location.href =
        `https://api.trakt.tv/oauth/authorize?response_type=code&client_id=${TRAKT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
}

/* ================================
   TMDB AUTH
================================ */
async function loginTMDB() {
    const res = await fetch(`https://api.themoviedb.org/3/authentication/token/new?api_key=${TMDB_KEY}`);
    const data = await res.json();
    localStorage.setItem('tmdb_request_token', data.request_token);
    window.location.href =
        `https://www.themoviedb.org/authenticate/${data.request_token}?redirect_to=${encodeURIComponent(REDIRECT_URI)}`;
}

async function createTMDBSession() {
    const request_token = localStorage.getItem('tmdb_request_token');
    const res = await fetch(`https://api.themoviedb.org/3/authentication/session/new?api_key=${TMDB_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_token })
    });
    const data = await res.json();
    localStorage.setItem('tmdb_session', data.session_id);
    cleanURL();
    retryPendingAction();
}

/* ================================
   ADD TO LIST LOGIC
================================ */
function addToTrakt(id, type) {
    const token = localStorage.getItem('trakt_token');
    if (!token) {
        pendingAction = () => addToTrakt(id, type);
        loginTrakt();
        return;
    }
    fetchUserTraktLists(token, id, type);
}

async function fetchUserTraktLists(token, mediaId, type) {
    const res = await fetch('https://api.trakt.tv/users/me/lists', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_ID
        }
    });
    const lists = await res.json();
    showListSelector(lists, (listId) => addItemToTraktList(token, listId, mediaId, type));
}

async function addItemToTraktList(token, listId, mediaId, type) {
    const body = {
        [type === 'movie' ? 'movies' : 'shows']: [{
            ids: { tmdb: mediaId }
        }]
    };
    await fetch(`https://api.trakt.tv/users/me/lists/${listId}/items`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_ID,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    alert('Added to Trakt list!');
}

function addToTMDB(id) {
    const session = localStorage.getItem('tmdb_session');
    if (!session) {
        pendingAction = () => addToTMDB(id);
        loginTMDB();
        return;
    }
    fetchTMDBLists(session, id);
}

async function fetchTMDBLists(session, mediaId) {
    const account = await fetch(`https://api.themoviedb.org/3/account?api_key=${TMDB_KEY}&session_id=${session}`);
    const accData = await account.json();
    const res = await fetch(`https://api.themoviedb.org/3/account/${accData.id}/lists?api_key=${TMDB_KEY}&session_id=${session}`);
    const lists = await res.json();
    showListSelector(lists.results, (listId) => addToTMDBList(listId, mediaId, session));
}

async function addToTMDBList(listId, mediaId, session) {
    await fetch(`https://api.themoviedb.org/3/list/${listId}/add_item?api_key=${TMDB_KEY}&session_id=${session}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: mediaId })
    });
    alert('Added to TMDB list!');
}

/* ================================
   LIST SELECTOR UI
================================ */
function showListSelector(lists, callback) {
    const body = document.getElementById('modal-body');
    body.innerHTML = '<h3>Select List</h3>';
    lists.forEach(list => {
        const btn = document.createElement('button');
        btn.className = 'list-btn';
        btn.textContent = list.name;
        btn.onclick = () => callback(list.ids?.slug || list.id);
        body.appendChild(btn);
    });
}

/* ================================
   UTILITIES
================================ */
function retryPendingAction() {
    if (pendingAction) {
        pendingAction();
        pendingAction = null;
    }
}

function cleanURL() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

/* ================================
   UI CONTROLS
================================ */
document.getElementById('nav-search').onclick = () => document.getElementById('search-overlay').classList.remove('modal-hidden');
document.getElementById('search-close').onclick = () => document.getElementById('search-overlay').classList.add('modal-hidden');
document.getElementById('modal-close').onclick = () => document.getElementById('modal-overlay').classList.add('modal-hidden');

/* ================================
   SEARCH LOGIC
================================ */
let timer;
document.getElementById('search-input').oninput = (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
        const query = e.target.value;
        if (query.length < 3) return;

        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        const results = document.getElementById('search-results');
        results.innerHTML = '';

        data.results.forEach(item => {
            if (item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv')) {
                renderCard(item.title || item.name, item.id, item.media_type, results);
            }
        });
    }, 500);
};
