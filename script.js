const TMDB_KEY = '37cc8cb617e62d17e6180754e7a94139';
const TRAKT_ID = 'e2b666343235c45fc18f12f2f256c29e5bb5977bc6ca9ca8d6a5bef7a7d6778f';

async function loadContent() {
    // 1. Fetch from Trakt
    const traktMovies = await fetch('https://api.trakt.tv/movies/trending', {
        headers: { 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID }
    }).then(res => res.json());

    const traktShows = await fetch('https://api.trakt.tv/shows/popular', {
        headers: { 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID }
    }).then(res => res.json());

    renderList(traktMovies, 'trending-movies', 'movie');
    renderList(traktShows, 'popular-shows', 'tv');
}

async function renderList(data, containerId, type) {
    const container = document.getElementById(containerId);
    
    for (const item of data.slice(0, 10)) {
        const media = item.movie || item; // Trakt trending nests inside 'movie', popular does not
        const tmdbId = media.ids.tmdb;

        // Fetch Image from TMDB
        const tmdbData = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}`).then(res => res.json());
        const posterPath = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w342${tmdbData.poster_path}` : '';

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img class="poster" src="${posterPath}" alt="${media.title}">
            <div class="card-title">${media.title}</div>
        `;
        container.appendChild(card);
    }
}

loadContent();

// Add these to your existing script.js

async function renderList(data, containerId, type) {
    const container = document.getElementById(containerId);
    
    for (const item of data.slice(0, 10)) {
        const media = item.movie || item; 
        const tmdbId = media.ids.tmdb;

        const tmdbData = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}`).then(res => res.json());
        const posterPath = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w342${tmdbData.poster_path}` : '';

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img class="poster" src="${posterPath}" alt="${media.title}">
            <div class="card-title">${media.title}</div>
        `;
        
        // CLICK EVENT
        card.onclick = () => showDetails(tmdbId, type);
        
        container.appendChild(card);
    }
}

async function showDetails(id, type) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    
    // Fetch details + videos (for trailer)
    const data = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=videos`).then(res => res.json());
    
    const trailer = data.videos.results.find(v => v.type === 'Trailer');
    const trailerLink = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '#';

    body.innerHTML = `
        <img class="details-poster" src="https://image.tmdb.org/t/p/w780${data.backdrop_path || data.poster_path}">
        <div class="details-title">${data.title || data.name}</div>
        <div style="margin-bottom:15px; color:var(--accent)">★ ${data.vote_average.toFixed(1)}</div>
        <div class="details-overview">${data.overview}</div>
        ${trailer ? `<a href="${trailerLink}" target="_blank" class="trailer-btn">▶ Play Trailer</a>` : ''}
    `;

    overlay.classList.remove('modal-hidden');
}

// Close Modal logic
document.getElementById('modal-close').onclick = () => {
    document.getElementById('modal-overlay').classList.add('modal-hidden');
};

// Close if clicking outside the content
document.getElementById('modal-overlay').onclick = (e) => {
    if(e.target.id === 'modal-overlay') {
        document.getElementById('modal-overlay').classList.add('modal-hidden');
    }
};

// Add to your existing script.js

const navSearch = document.getElementById('nav-search');
const searchOverlay = document.getElementById('search-overlay');
const searchInput = document.getElementById('search-input');
const searchClose = document.getElementById('search-close');
const searchResults = document.getElementById('search-results');

// Open/Close Search
navSearch.onclick = () => searchOverlay.classList.remove('modal-hidden');
searchClose.onclick = () => {
    searchOverlay.classList.add('modal-hidden');
    searchInput.value = '';
    searchResults.innerHTML = '';
};

// Search Logic with Debounce
let searchTimer;
searchInput.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        if (searchInput.value.length > 2) {
            performSearch(searchInput.value);
        }
    }, 500); // Wait 500ms after user stops typing
};

async function performSearch(query) {
    // TMDB Multi-search finds Movies, TV, and People simultaneously
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url).then(r => r.json());
    
    searchResults.innerHTML = ''; // Clear previous results

    res.results.forEach(item => {
        if (item.media_type === 'person' || !item.poster_path) return;

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img class="poster" src="https://image.tmdb.org/t/p/w342${item.poster_path}">
            <div class="card-title">${item.title || item.name}</div>
        `;
        
        // Use the existing modal details function we built earlier!
        card.onclick = () => showDetails(item.id, item.media_type);
        
        searchResults.appendChild(card);
    });
}
