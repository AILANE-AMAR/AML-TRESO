import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined); // undefined = chargement, null = déconnecté

    useEffect(() => {
        api('/api/auth/me')
            .then(r => (r.ok ? r.json() : null))
            .then(setUser)
            .catch(() => setUser(null));
        const onExpired = () => setUser(null);
        window.addEventListener('auth:expired', onExpired);
        return () => window.removeEventListener('auth:expired', onExpired);
    }, []);

    const login = useCallback(async (username, password) => {
        const r = await api('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || 'Connexion impossible.');
        setUser(data);
    }, []);

    const logout = useCallback(async () => {
        await api('/api/auth/logout', { method: 'POST' });
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}