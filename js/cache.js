// Simple in-memory cache for TMDB posters
const tmdbCache = new Map();

export function getCachedTMDB(id) {
    return tmdbCache.get(id);
}

export function setCachedTMDB(id, data) {
    tmdbCache.set(id, data);
}
