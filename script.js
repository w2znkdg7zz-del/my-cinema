const TMDB_KEY = 'YOUR_TMDB_API_KEY';
const TRAKT_ID = 'YOUR_TRAKT_CLIENT_ID';

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
