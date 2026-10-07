import { useEffect, useState } from 'react'
import { api, put, del, upload, euro } from './api.js'

function Edition({ op, classeurs, onClose, onChange, setMsg }) {
  const initial = classeurs.find((c) => c.id === op.classeur_id)
  const [categorieId, setCategorieId] = useState(initial?.categorie_id ?? '')
  const [classeurId, setClasseurId] = useState(op.classeur_id ?? '')
  const [commentaire, setCommentaire] = useState(op.commentaire ?? '')
  const [erreur, setErreur] = useState('')

  const categories = [...new Map(classeurs.map((c) => [c.categorie_id, c.categorie_nom]))]
  const classeursDuDossier = classeurs.filter((c) => c.categorie_id === Number(categorieId))

  const enregistrer = async () => {
    try {
      await put(`/operations/${op.id}`, { classeurId: classeurId ? Number(classeurId) : null, commentaire })
      setMsg('Transaction enregistrée.')
      onChange()
      onClose()
    } catch (e) { setErreur(e.message) }
  }
  const ajouterJustif = async (e) => {
    const input = e.target
    const f = input.files[0]; if (!f) return
    try {
      // enregistre d'abord le classeur et le commentaire choisis, puis envoie le fichier
      await put(`/operations/${op.id}`, { classeurId: Number(classeurId), commentaire })
      await upload(`/operations/${op.id}/justificatifs`, f)
      setErreur('')
      setMsg('Justificatif envoyé dans Nextcloud.')
      onChange()
    } catch (err) { setErreur(err.message) }
    input.value = ''
  }

  return (
      <div className="fond" onClick={onClose}>
        <div className="fenetre" onClick={(e) => e.stopPropagation()}>
          <h2>Modifier la transaction</h2>
          <p className="resume">
            {op.date_operation} — {op.nature} — <strong className={op.montant < 0 ? 'neg' : 'pos'}>{euro(op.montant)}</strong><br />
            {op.libelle}
          </p>

          <label>Dossier (catégorie)
            <select value={categorieId} onChange={(e) => { setCategorieId(e.target.value); setClasseurId('') }}>
              <option value="">— choisir —</option>
              {categories.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
            </select>
          </label>
          <label>Étiquette (classeur)
            <select value={classeurId} onChange={(e) => setClasseurId(e.target.value)} disabled={!categorieId}>
              <option value="">— choisir —</option>
              {classeursDuDossier.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </label>
          <label>Commentaire
            <textarea rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </label>

          <h3>Justificatifs</h3>
          {op.justificatifs.map((j) => <a key={j.id} href={`/api/justificatifs/${j.id}`} target="_blank" rel="noreferrer">📎 {j.nom}</a>)}
          {classeurId
              ? <label className="bouton petit">Ajouter un justificatif<input type="file" hidden onChange={ajouterJustif} /></label>
              : <p className="aide">Choisis d'abord une étiquette (classeur) pour pouvoir ajouter un justificatif.</p>}

          {erreur && <p className="msg erreur">{erreur}</p>}
          <div className="boutons">
            <button className="secondaire" onClick={onClose}>Fermer</button>
            <button onClick={enregistrer}>Enregistrer</button>
          </div>
        </div>
      </div>
  )
}

export default function Transactions({ mandatId, classeurs }) {
  const [ops, setOps] = useState([])
  const [mois, setMois] = useState('')
  const [aClasser, setAClasser] = useState(false)
  const [msg, setMsg] = useState('')
  const [edition, setEdition] = useState(null)

  const charger = () =>
      api(`/operations?mandatId=${mandatId}&mois=${mois}&aClasser=${aClasser}`).then(setOps).catch((e) => setMsg(e.message))
  useEffect(() => { charger() }, [mandatId, mois, aClasser])

  const importer = async (e) => {
    const f = e.target.files[0]; if (!f) return
    try {
      const r = await upload('/operations/import', f, { mandatId })
      setMsg(`${r.ajoutees} transactions ajoutées, ${r.doublonsIgnores} doublons ignorés.`)
      charger()
    } catch (err) { setMsg('Erreur : ' + err.message) }
    e.target.value = ''
  }
  const supprimer = async (o) => {
    if (!window.confirm(`Supprimer cette transaction ?\n${o.date_operation} — ${o.libelle} — ${euro(o.montant)}`)) return
    try { await del(`/operations/${o.id}`); setMsg('Transaction supprimée.'); charger() }
    catch (err) { setMsg('Erreur : ' + err.message) }
  }
  const nomClasseur = (id) => {
    const c = classeurs.find((k) => k.id === id)
    return c ? `${c.categorie_nom} › ${c.nom}` : ''
  }
  const total = ops.reduce((s, o) => s + Number(o.montant), 0)
  const opEdit = ops.find((o) => o.id === edition)

  return (
      <section>
        <div className="barre">
          <label className="bouton">Importer un relevé CSV<input type="file" accept=".csv,text/csv" hidden onChange={importer} /></label>
          <label>Mois <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} /></label>
          <label><input type="checkbox" checked={aClasser} onChange={(e) => setAClasser(e.target.checked)} /> À classer seulement</label>
          <strong>{ops.length} lignes — total {euro(total)}</strong>
        </div>
        {msg && <p className="msg">{msg}</p>}
        <table>
          <thead><tr><th>Date</th><th>Nature</th><th>Motif</th><th className="num">Montant</th><th>Actions</th></tr></thead>
          <tbody>
          {ops.map((o) => (
              <tr key={o.id} className={o.classeur_id ? '' : 'aclasser'}>
                <td>{o.date_operation}</td>
                <td>{o.nature}</td>
                <td>
                  {o.libelle}
                  <div className="petit-texte">
                    {o.classeur_id ? nomClasseur(o.classeur_id) : 'À classer'}
                    {o.justificatifs.length > 0 && ` · 📎 ${o.justificatifs.length}`}
                    {o.commentaire && ` · 💬 ${o.commentaire}`}
                  </div>
                </td>
                <td className={'num ' + (o.montant < 0 ? 'neg' : 'pos')}>{euro(o.montant)}</td>
                <td className="actions">
                  <button onClick={() => setEdition(o.id)}>Modifier</button>
                  <button className="danger" onClick={() => supprimer(o)}>Supprimer</button>
                </td>
              </tr>
          ))}
          </tbody>
        </table>
        {opEdit && <Edition key={opEdit.id} op={opEdit} classeurs={classeurs} onClose={() => setEdition(null)} onChange={charger} setMsg={setMsg} />}
      </section>
  )
}