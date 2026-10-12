import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function Login() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await login(username, password);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f5f7' }}>
            <form onSubmit={submit} style={{
                width: 340, padding: 28, background: '#fff', borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,.08)', display: 'grid', gap: 14,
            }}>
                <h2 style={{ margin: 0 }}>Trésorerie</h2>
                <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                    Connectez-vous avec votre compte Nextcloud.
                </p>
                <input placeholder="Identifiant Nextcloud" autoComplete="username" autoFocus
                       value={username} onChange={e => setUsername(e.target.value)} />
                <input type="password" placeholder="Mot de passe" autoComplete="current-password"
                       value={password} onChange={e => setPassword(e.target.value)} />
                {error && <div style={{ color: '#b00020', fontSize: 14 }}>{error}</div>}
                <button type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
            </form>
        </div>
    );
}