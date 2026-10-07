import { useState } from 'react'
import { post, api } from './api.js'

export default function Reglages({ mandats, mandatId, classeurs, onChange }) {
  const [cats, setCats] = useState([])
  const [m, setM] = useState({ nom: '', debut: '', fin: '', copier: true })
  const [c, setC] = useState({ categorieId: '', nom: '' })
  if (!cats.length) api('/categories').then(setCats)

  const creerMandat = async (e) => {
    e.preventDefault()
    await post('/mandats', { nom: m.nom, debut: m.debut, fin: m.fin, copierClasseursDe: m.copier ? mandatId : null })
    setM({ nom: '', debut: '', fin: '', copier: true }); onChange()
  }
  const creerClasseur = async (e) => {
    e.preventDefault()
    await post('/classeurs', { mandatId, categorieId: Number(c.categorieId), nom: c.nom })
    setC({ ...c, nom: '' }); onChange()
  }
  return (
    <section className="reglages">
      <h2>Nouveau mandat</h2>
      <form onSubmit={creerMandat} className="barre">
        <input placeholder="2026 - 2027" required value={m.nom} onChange={(e) => setM({ ...m, nom: e.target.value })} />
        <input type="date" required value={m.debut} onChange={(e) => setM({ ...m, debut: e.target.value })} />
        <input type="date" required value={m.fin} onChange={(e) => setM({ ...m, fin: e.target.value })} />
        <label><input type="checkbox" checked={m.copier} onChange={(e) => setM({ ...m, copier: e.target.checked })} /> Reprendre les classeurs du mandat sélectionné</label>
        <button>Créer</button>
      </form>

      <h2>Ajouter un classeur au mandat sélectionné</h2>
      <form onSubmit={creerClasseur} className="barre">
        <select required value={c.categorieId} onChange={(e) => setC({ ...c, categorieId: e.target.value })}>
          <option value="">Catégorie…</option>
          {cats.map((k) => <option key={k.id} value={k.id}>{k.nom}</option>)}
        </select>
        <input placeholder="Nom du classeur" required value={c.nom} onChange={(e) => setC({ ...c, nom: e.target.value })} />
        <button>Ajouter</button>
      </form>
      <p>{classeurs.length} classeurs dans ce mandat.</p>
    </section>
  )
}
