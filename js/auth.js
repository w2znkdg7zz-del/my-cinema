import { TRAKT_ID, TRAKT_SECRET, TMDB_KEY, REDIRECT_URI } from './config.js';

let pendingAction = null;
export { pendingAction };

export function setPendingAction(action) {
    pendingAction = action;
}

export function retryPendingAction() {
    if (pendingAction) {
        pendingAction();
        pendingAction = null;
    }
}

export function cleanURL() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

// Trakt OAuth
export function loginTrakt() {
    window.location.href = `https://api.trakt.tv/oauth/authorize?response_type=code&client_id=${TRAKT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
}

export async function exchangeTraktToken(code) {
    const res = await fetch('https://api.trakt.tv/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code, client_id: TRAKT_ID, client_secret: TRAKT_SECRET,
            redirect_uri: REDIRECT_URI, grant_type: 'authorization_code'
        })
    });
    const data = await res.json();
    localStorage.setItem('trakt_token', data.access_token);
    cleanURL();
    retryPendingAction();
}

// TMDB OAuth
export async function loginTMDB() {
    const res = await fetch(`https://api.themoviedb.org/3/authentication/token/new?api_key=${TMDB_KEY}`);
    const data = await res.json();
    localStorage.setItem('tmdb_request_token', data.request_token);
    window.location.href = `https://www.themoviedb.org/authenticate/${data.request_token}?redirect_to=${encodeURIComponent(REDIRECT_URI)}`;
}

export async function createTMDBSession() {
    const request_token = localStorage.getItem('tmdb_request_token');
    const res = await fetch(`https://api.themoviedb.org/3/authentication/session/new?api_key=${TMDB_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_token })
    });
    const data = await res.json();
    localStorage.setItem('tmdb_session', data.session_id);
    cleanURL();
    retryPendingAction();
}
