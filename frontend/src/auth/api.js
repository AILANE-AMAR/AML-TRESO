// Remplace fetch() partout : déclenche la déconnexion si la session a expiré
export async function api(path, options = {}) {
    const res = await fetch(path, { credentials: 'same-origin', ...options });
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
        window.dispatchEvent(new Event('auth:expired'));
    }
    return res;
}