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
