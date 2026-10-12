import { useEffect, useState } from 'react'
import { api, euro } from './api.js'

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

// --- Données exportées : uniquement l'essentiel (catégories dans le CR + sous-totaux) ---
const lignesExport = (cr) => {
    const out = []
    cr.categories.filter((c) => !c.horsCr).forEach((c) => {
        out.push({ type: 'categorie', nom: c.nom, charges: +c.charges, produits: +c.produits, balance: +c.balance })
        c.classeurs.forEach((k) =>
            out.push({ type: 'classeur', nom: k.nom, charges: +k.charges, produits: +k.produits, balance: +k.balance }))
    })
    out.push({ type: 'total', nom: 'SOUS-TOTAUX', charges: +cr.totalCr.charges, produits: +cr.totalCr.produits, balance: +cr.totalCr.balance })
    return out
}

const telecharger = (blob, nom) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nom
    a.click()
    URL.revokeObjectURL(url)
}

// --- Export CSV (simple, sans style : le format CSV n'en gère pas) ---
const num = (n) => Number(n).toFixed(2).replace('.', ',')
const esc = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

function exportCsv(cr) {
    const lignes = [['Catégorie / Classeur', 'Charges', 'Produits', 'Balance']]
    lignesExport(cr).forEach((l) => lignes.push([l.nom, num(l.charges), num(l.produits), num(l.balance)]))
    // BOM + séparateur ; : s'ouvre correctement dans Excel en français
    const texte = '\uFEFF' + lignes.map((l) => l.map(esc).join(';')).join('\r\n')
    telecharger(new Blob([texte], { type: 'text/csv;charset=utf-8' }), 'compte-resultat.csv')
}

// --- Export Excel stylé ---
async function exportExcel(cr) {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Compte de résultat')
    ws.columns = [{ width: 42 }, { width: 18 }, { width: 18 }, { width: 18 }]

    const bordure = { style: 'thin', color: { argb: 'FFCCD3DD' } }
    const FMT = '#,##0.00 "€";-#,##0.00 "€";0.00 "€"'

    const entete = ws.addRow(['Catégorie / Classeur', 'Charges', 'Produits', 'Balance'])
    entete.eachCell((cell, i) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } }
        cell.alignment = { horizontal: i === 1 ? 'left' : 'right', vertical: 'middle' }
    })
    entete.height = 22

    lignesExport(cr).forEach((l) => {
        const row = ws.addRow([l.nom, l.charges, l.produits, l.balance])
        const total = l.type === 'total'
        row.eachCell((cell, i) => {
            cell.border = { top: bordure, bottom: bordure, left: bordure, right: bordure }
            if (i === 1) {
                cell.alignment = { indent: l.type === 'classeur' ? 2 : 0 }
                cell.font = { bold: l.type !== 'classeur', color: { argb: total ? 'FFFFFFFF' : 'FF000000' } }
            } else {
                cell.numFmt = FMT
                cell.alignment = { horizontal: 'right' }
                const v = Number(cell.value)
                const couleur = v < 0 ? (total ? 'FFFFB4B4' : 'FFC62828') : v > 0 ? (total ? 'FFB9F6CA' : 'FF2E7D32') : 'FF000000'
                cell.font = { bold: l.type !== 'classeur', color: { argb: couleur } }
            }
            if (l.type === 'categorie') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1F6' } }
            if (total) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } }
        })
    })

    const buffer = await wb.xlsx.writeBuffer()
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