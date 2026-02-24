/* ================================
   CONFIG
================================ */
const TRAKT_ID = 'caae7a3191de89620d5a2f2955ebce640215e6a81b0cc7657b773de5edebfd40';
const TRAKT_SECRET = '35a89bd5967a9151de677fd44a4872ab93efba1cc09fee80c27b9176459ece46';
const TMDB_KEY = '37cc8cb617e62d17e6180754e7a94139';
const REDIRECT_URI = 'https://w2znkdg7zz-del.github.io/my-cinema/';

/* ================================
   STATE & CACHE
================================ */
let pendingAction = null;
const posterCache = {};         // { tmdbId: posterUrl }
const sectionDataCache = {};    // { containerId: fullDataArray }

/* ================================
   INIT
================================ */
init();
handleOAuthCallback();

async function init() {
    fetchTrakt('https://api.trakt.tv/movies/trending', 'trending-movies', 'movie', 'Trending Movies', 0, 15);
    fetchTrakt('https://api.trakt.tv/shows/popular', 'popular-shows', 'tv', 'Popular TV Shows', 0, 15);
    fetchTrakt('https://api.trakt.tv/shows/anticipated', 'anticipated', 'tv', 'Most Anticipated', 0, 15);
}

/* ================================
   TRKT FETCH & RENDER
================================ */
async function fetchTrakt(url, containerId, type, categoryLabel, start = 0, limit = 15) {
    try {
        const res = await fetch(url, {  
            headers: {  
                'trakt-api-version': '2',  
                'trakt-api-key': TRAKT_ID  
            }
        });
        const data = await res.json();
        const container = document.getElementById(containerId);

        // Cache full section data (for modal)
        sectionDataCache[containerId] = data;

        // Render homepage batch
        data.slice(start, start + limit).forEach(item => {
            const media = item.movie || item.show || item;
            if (media.ids && media.ids.tmdb) {
                renderCard(media.title || media.name, media.ids.tmdb, type, container);
            }
        });

        // Add "See More" card
        const seeMoreCard = document.createElement('div');
        seeMoreCard.className = 'card see-more';
        seeMoreCard.innerHTML = `<div class="poster">See More</div>`;
        seeMoreCard.onclick = () => openSectionModal(containerId, categoryLabel, type, url);
        container.appendChild(seeMoreCard);

    } catch (err) {
        console.error("Error fetching Trakt data:", err);
    }
}

/* ================================
   RENDER CARD WITH CACHED POSTER
================================ */
async function renderCard(title, id, type, container) {
    if (!id) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="poster"></div><div class="card-title">${title}</div>`;
    card.onclick = () => showDetails(id, type);
    container.appendChild(card);

    if (posterCache[id]) {
        const posterDiv = card.querySelector('.poster');
        posterDiv.outerHTML = `<img class="poster" src="${posterCache[id]}" alt="${title}">`;
        return;
    }

    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}`);
        const data = await res.json();
        if (data.poster_path) {
            const posterUrl = `https://image.tmdb.org/t/p/w342${data.poster_path}`;
            posterCache[id] = posterUrl;
            const posterDiv = card.querySelector('.poster');
            posterDiv.outerHTML = `<img class="poster" src="${posterUrl}" alt="${title}">`;
        }
    } catch (err) {
        console.error("Error fetching poster:", err);
    }
}

/* ================================
   SEE MORE MODAL
================================ */
async function openSectionModal(containerId, categoryLabel, type, apiUrl) {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    modal.classList.remove('modal-hidden');
    body.innerHTML = `<h3 style="margin-bottom:15px;">${categoryLabel}</h3><div class="grid"></div>`;
    const grid = body.querySelector('.grid');

    // Fetch full section if needed
    let items = sectionDataCache[containerId];
    if (!items || items.length === 0) {
        try {
            const res = await fetch(apiUrl, {
                headers: {  
                    'trakt-api-version': '2',  
                    'trakt-api-key': TRAKT_ID  
                }
            });
            items = await res.json();
            sectionDataCache[containerId] = items;
        } catch (err) {
            grid.innerHTML = '<p>Error loading items.</p>';
            return;
        }
    }

    // Render all items
    items.forEach(item => {
        const media = item.movie || item.show || item;
        if (media.ids && media.ids.tmdb) {
            renderCard(media.title || media.name, media.ids.tmdb, type, grid);
        }
    });
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

    // Fetch user lists from Trakt
    fetch('https://api.trakt.tv/users/me/lists', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_ID
        }
    })
    .then(res => res.json())
    .then(lists => {
        // Use the new clean list selector
        showListSelector(lists, async (listId) => {
            // Add the item to the chosen list
            const body = {
                [type === 'movie' ? 'movies' : 'shows']: [{
                    ids: { tmdb: id }
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
            document.getElementById('modal-overlay').classList.add('modal-hidden');
        });
    });
}

function addToTMDB(id) {
    const session = localStorage.getItem('tmdb_session');
    if (!session) {
        pendingAction = () => addToTMDB(id);
        loginTMDB();
        return;
    }

    // Fetch user TMDB lists
    fetch(`https://api.themoviedb.org/3/account?api_key=${TMDB_KEY}&session_id=${session}`)
        .then(res => res.json())
        .then(accData => fetch(`https://api.themoviedb.org/3/account/${accData.id}/lists?api_key=${TMDB_KEY}&session_id=${session}`))
        .then(res => res.json())
        .then(lists => {
            showListSelector(lists.results, async (listId) => {
                await fetch(`https://api.themoviedb.org/3/list/${listId}/add_item?api_key=${TMDB_KEY}&session_id=${session}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ media_id: id })
                });
                alert('Added to TMDB list!');
                document.getElementById('modal-overlay').classList.add('modal-hidden');
            });
        });
}
/* ================================
   LIST SELECTOR UI WITH TMDB MEDIA TYPE
================================ */
async function showListSelector(lists, callback) {
    const body = document.getElementById('modal-body');
    body.innerHTML = '<h3>Select List</h3>';

    const buttons = []; // Collect buttons to preserve order

    for (const list of lists) {
        const btn = document.createElement('button');
        btn.className = 'list-btn';

        let label = list.name;

        // TMDB list: fetch media types to display
        if (list.id && list.item_count !== undefined && localStorage.getItem('tmdb_session')) {
            try {
                const session = localStorage.getItem('tmdb_session');
                const res = await fetch(`https://api.themoviedb.org/3/list/${list.id}?api_key=${TMDB_KEY}&session_id=${session}`);
                const details = await res.json();

                const types = new Set(details.items.map(i => i.media_type));
                let mediaTypeLabel;
                if (types.size === 1) {
                    mediaTypeLabel = types.has('movie') ? 'Movie List' : 'TV List';
                } else {
                    mediaTypeLabel = 'Mixed List';
                }

                label += ` (${mediaTypeLabel}, ${details.items.length} items)`;
            } catch (err) {
                console.warn('Error fetching TMDB list details:', err);
                label += ` (List, ${list.item_count} items)`;
            }
        } 
        // Trakt list: just show list name (no extra label)
        else if (list.ids?.slug) {
            // optional: add item count if available
            if (list.item_count) label += ` (${list.item_count} items)`;
        }

        btn.textContent = label;

        // Button click triggers callback
        btn.onclick = () => callback(list.ids?.slug || list.id);

        buttons.push(btn);
    }

    // Append buttons in collected order (top-to-bottom)
    buttons.forEach(btn => body.appendChild(btn));
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
   SEARCH LOGIC WITH POSTER CACHING
================================ */
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
                const posterId = item.id;
                if (!posterCache[posterId]) {
                    posterCache[posterId] = `https://image.tmdb.org/t/p/w342${item.poster_path}`;
                }
                renderCard(item.title || item.name, posterId, item.media_type, results);
            }
        });
    }, 500);
};
