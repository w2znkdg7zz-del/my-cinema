/* ================================
   CONFIG
================================ */

const TRAKT_ID = 'YOUR_TRAKT_ID';
const TRAKT_SECRET = 'YOUR_TRAKT_SECRET';
const TMDB_KEY = 'YOUR_TMDB_KEY';
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

/* ================================
   TMDB LISTS
================================ */

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
