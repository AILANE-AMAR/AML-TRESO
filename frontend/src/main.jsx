import './style.css'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './auth/Login';

function Gate() {
    const { user } = useAuth();
    if (user === undefined) return <p style={{ padding: 20 }}>Chargement…</p>;
    if (user === null) return <Login />;
    return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <AuthProvider>
        <Gate />
    </AuthProvider>
);