// Lignes exportées : uniquement l'essentiel (catégories dans le CR + sous-totaux)
export const lignesExport = (cr) => {
    const out = []
    cr.categories.filter((c) => !c.horsCr).forEach((c) => {
        out.push({ type: 'categorie', nom: c.nom, charges: +c.charges, produits: +c.produits, balance: +c.balance })
        c.classeurs.forEach((k) =>
            out.push({ type: 'classeur', nom: k.nom, charges: +k.charges, produits: +k.produits, balance: +k.balance }))
    })
    out.push({ type: 'total', nom: 'SOUS-TOTAUX', charges: +cr.totalCr.charges, produits: +cr.totalCr.produits, balance: +cr.totalCr.balance })
    return out
}

const num = (n) => Number(n).toFixed(2).replace('.', ',')
const esc = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

export function construireCsv(cr) {
    const lignes = [['Catégorie / Classeur', 'Charges', 'Produits', 'Balance']]
    lignesExport(cr).forEach((l) => lignes.push([l.nom, num(l.charges), num(l.produits), num(l.balance)]))
    // BOM + séparateur ; : s'ouvre correctement dans Excel en français
    return '\uFEFF' + lignes.map((l) => l.map(esc).join(';')).join('\r\n')
}

export async function construireExcel(cr) {
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
    return wb
}