import {useEffect, useState} from 'react'
import {api} from './api.js'
import Transactions from './Transactions.jsx'
import CompteResultat from './CompteResultat.jsx'
import Reglages from './Reglages.jsx'
import {useAuth} from './auth/AuthContext'

export default function App() {
    const [onglet, setOnglet] = useState('transactions')
    const [mandats, setMandats] = useState([])
    const [mandatId, setMandatId] = useState(null)
    const [classeurs, setClasseurs] = useState([])
    const {user, logout} = useAuth();

    const chargerMandats = () => api('/mandats').then((m) => {
        setMandats(m);
        if (!mandatId && m.length) setMandatId(m[0].id)
    })
    const chargerClasseurs = () => mandatId && api('/classeurs?mandatId=' + mandatId).then(setClasseurs)

    useEffect(() => {
        chargerMandats()
    }, [])
    useEffect(() => {
        chargerClasseurs()
    }, [mandatId])

    return (
        <div className="page">
            <header>
                <h1>Trésorerie</h1>
                <label>Mandat&nbsp;
                    <select value={mandatId ?? ''} onChange={(e) => setMandatId(Number(e.target.value))}>
                        {mandats.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                    </select>
                </label>
                <nav>
                    {[['transactions', 'Transactions'], ['cr', 'Compte de résultat'], ['reglages', 'Réglages']].map(([k, l]) =>
                        <button key={k} className={onglet === k ? 'actif' : ''}
                                onClick={() => setOnglet(k)}>{l}</button>)}
                </nav>
                <div style={{marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center'}}>
                    <span>{user.displayName}</span>
                    <button onClick={logout}>Déconnexion</button>
                </div>
            </header>
            {mandatId && onglet === 'transactions' && <Transactions mandatId={mandatId} classeurs={classeurs}/>}
            {mandatId && onglet === 'cr' && <CompteResultat mandatId={mandatId}/>}
            {onglet === 'reglages' && <Reglages mandats={mandats} mandatId={mandatId} classeurs={classeurs}
                                                onChange={() => {
                                                    chargerMandats();
                                                    chargerClasseurs()
                                                }}/>}
        </div>
    )
}
