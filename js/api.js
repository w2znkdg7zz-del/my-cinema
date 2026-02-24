import { TMDB_KEY, TRAKT_ID } from './config.js';
import { getCachedTMDB, setCachedTMDB } from './cache.js';

export async function fetchTrakt(url) {
    const res = await fetch(url, {
        headers: { 'trakt-api-version': '2', 'trakt-api-key': TRAKT_ID }
    });
    return res.json();
}

export async function fetchTMDBDetails(type, id) {
    const cached = getCachedTMDB(id);
    if (cached) return cached;

    const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=videos`);
    const data = await res.json();
    setCachedTMDB(id, data);
    return data;
}

export async function searchTMDB(query) {
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`);
    return res.json();
}
