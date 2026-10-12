import { useEffect, useState } from 'react'
import { api, euro } from './api.js'
import { construireCsv, construireExcel } from './exports.js'

const Ligne = ({ nom, charges, produits, balance, classe = '', indent, onClick }) => (
    <tr className={classe + (onClick ? ' cliquable' : '')} onClick={onClick}>
        <td style={{ paddingLeft: indent ? 28 : 8 }}>{nom}</td>
        <td className={'num ' + (charges < 0 ? 'neg' : charges > 0 ? 'pos' : '')}>{euro(charges)}</td>
        <td className={'num ' + (produits < 0 ? 'neg' : produits > 0 ? 'pos' : '')}>{euro(produits)}</td>
        <td className={'num ' + (balance < 0 ? 'neg' : 'pos')}>{euro(balance)}</td>
    </tr>
)

// --- Page : toutes les transactions d'un classeur ---
function DetailClasseur({ mandatId, classeur, onRetour }) {
    const [ops, setOps] = useState(null)
    useEffect(() => {
        api(`/operations?mandatId=${mandatId}&classeurId=${classeur.id}`).then(setOps)
    }, [mandatId, classeur.id])
    if (!ops) return <p>Chargement…</p>

    const charges = ops.filter((o) => o.montant < 0).reduce((s, o) => s + Number(o.montant), 0)
    const produits = ops.filter((o) => o.montant > 0).reduce((s, o) => s + Number(o.montant), 0)

    return (
        <section>
            <div className="barre no-print">
                <button className="bouton-retour" onClick={onRetour}>← Retour au compte de résultat</button>
            </div>
            <h2>{classeur.categorie} › {classeur.nom}</h2>
            <p className="msg">
                {ops.length} transactions — Charges {euro(charges)} — Produits {euro(produits)} — Balance <strong>{euro(charges + produits)}</strong>
            </p>
            <table>
                <thead><tr><th>Date</th><th>Nature</th><th>Motif</th><th className="num">Montant</th><th>Commentaire</th><th>Justificatifs</th></tr></thead>
                <tbody>
                {ops.map((o) => (
                    <tr key={o.id}>
                        <td>{o.date_operation}</td>
                        <td>{o.nature}</td>
                        <td>{o.libelle}</td>
                        <td className={'num ' + (o.montant < 0 ? 'neg' : 'pos')}>{euro(o.montant)}</td>
                        <td>{o.commentaire}</td>
                        <td>{o.justificatifs.map((j) => (
                            <a key={j.id} href={`/api/justificatifs/${j.id}`} target="_blank" rel="noreferrer">📎 {j.nom}</a>
                        ))}</td>
                    </tr>
                ))}
                {ops.length === 0 && <tr><td colSpan={6}>Aucune transaction dans ce classeur.</td></tr>}
                </tbody>
            </table>
        </section>
    )
}


const telecharger = (blob, nom) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nom
    a.click()
    URL.revokeObjectURL(url)
}
const exportCsv = (cr) =>
    telecharger(new Blob([construireCsv(cr)], { type: 'text/csv;charset=utf-8' }), 'compte-resultat.csv')

async function exportExcel(cr) {
    const buffer = await (await construireExcel(cr)).xlsx.writeBuffer()
    telecharger(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        'compte-resultat.xlsx'
    )
}



export default function CompteResultat({ mandatId }) {
    const [cr, setCr] = useState(null)
    const [detail, setDetail] = useState(null)
    const [menu, setMenu] = useState(false)
    useEffect(() => { setDetail(null); api('/compte-resultat?mandatId=' + mandatId).then(setCr) }, [mandatId])
    if (!cr) return <p>Chargement…</p>
    if (detail) return <DetailClasseur mandatId={mandatId} classeur={detail} onRetour={() => setDetail(null)} />

    const dans = cr.categories.filter((c) => !c.horsCr)
    const hors = cr.categories.filter((c) => c.horsCr)
    const bloc = (horsCr) => (c) => [
        <Ligne key={c.nom} {...c} classe={'categorie' + (horsCr ? ' hors-print' : '')} />,
        ...c.classeurs.map((k) => (
            <Ligne key={c.nom + k.nom} {...k} indent classe={horsCr ? 'hors-print' : ''}
                   onClick={() => setDetail({ id: k.id, nom: k.nom, categorie: c.nom })} />
        )),
    ]
    const ecart = Number(cr.soldeTotalReleve) - (Number(cr.totalCr.balance) + Number(cr.totalHorsCr.balance)
        + Number(cr.nonClasse.charges) + Number(cr.nonClasse.produits))

    const choisir = (fn) => { setMenu(false); fn() }

    return (
        <section>
            <div className="barre no-print">
                <div className="menu-dl">
                    <button className="bouton-retour" onClick={() => setMenu(!menu)}>⬇ Télécharger ▾</button>
                    {menu && (
                        <div className="menu-dl-liste">
                            <button onClick={() => choisir(() => window.print())}>📄 PDF</button>
                            <button onClick={() => choisir(() => exportExcel(cr))}>📊 Excel (.xlsx, avec couleurs)</button>
                            <button onClick={() => choisir(() => exportCsv(cr))}>📋 CSV (simple)</button>
                        </div>
                    )}
                </div>
                <span className="aide">Clique sur un classeur pour voir ses transactions.</span>
            </div>
            <h2 className="titre-impression">Compte de résultat</h2>
            <table>
                <thead><tr><th>Catégorie / Classeur</th><th className="num">Charges</th><th className="num">Produits</th><th className="num">Balance</th></tr></thead>
                <tbody>
                {dans.flatMap(bloc(false))}
                <Ligne nom="SOUS-TOTAUX" {...cr.totalCr} classe="total" />
                {hors.flatMap(bloc(true))}
                <Ligne nom="RESTE HORS CR" {...cr.totalHorsCr} classe="total hors-print" />
                <Ligne nom={`Non classé (${cr.nonClasse.nb} lignes)`} charges={cr.nonClasse.charges} produits={cr.nonClasse.produits}
                       balance={Number(cr.nonClasse.charges) + Number(cr.nonClasse.produits)} classe="aclasser hors-print" />
                </tbody>
            </table>
            <p className="msg no-print">Solde total du relevé : {euro(cr.soldeTotalReleve)} — contrôle : {Math.abs(ecart) < 0.005 ? '✅ tout concorde' : '⚠️ écart de ' + euro(ecart)}</p>
        </section>
    )
}