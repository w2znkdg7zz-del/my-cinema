const TMDB_KEY = '37cc8cb617e62d17e6180754e7a94139';
const TRAKT_ID = 'e2b666343235c45fc18f12f2f256c29e5bb5977bc6ca9ca8d6a5bef7a7d6778f';

async function init() {
    fetchTrakt('https://api.trakt.tv/movies/trending', 'trending-movies', 'movie');
    fetchTrakt('https://api.trakt.tv/shows/popular', 'popular-shows', 'tv');
    fetchTrakt('https://api.trakt.tv/shows/anticipated', 'anticipated', 'tv');
}

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
            // FIX: Check if media is nested (Trending) or top-level (Popular/Anticipated)
            const media = item.movie || item.show || item;
            
            // Log for debugging (Remove once it works)
            console.log(`Loading ${type}:`, media.title);

            if (media.ids && media.ids.tmdb) {
                renderCard(media.title, media.ids.tmdb, type, container);
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

    // Dynamic Poster Fetch from TMDB
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
        `;
    } catch (err) {
        body.innerHTML = '<p>Error loading details.</p>';
    }
}

// UI Controls
document.getElementById('nav-search').onclick = () => document.getElementById('search-overlay').classList.remove('modal-hidden');
document.getElementById('search-close').onclick = () => document.getElementById('search-overlay').classList.add('modal-hidden');
document.getElementById('modal-close').onclick = () => document.getElementById('modal-overlay').classList.add('modal-hidden');

// Search Logic
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

init();
