// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lignesExport, construireCsv, construireExcel } from './exports.js'

const cr = {
    categories: [
        {
            nom: 'Événements', horsCr: false, charges: '-50', produits: '100', balance: '50',
            classeurs: [
                { nom: 'Galette', charges: '-50', produits: '100', balance: '50' },
                { nom: 'Escape; "Game"', charges: '0', produits: '0', balance: '0' },
            ],
        },
        { nom: 'Dépenses perso', horsCr: true, charges: '-10', produits: '0', balance: '-10', classeurs: [] },
    ],
    totalCr: { charges: '-50', produits: '100', balance: '50' },
}

describe('lignesExport', () => {
    it('exclut les catégories hors compte de résultat', () => {
        expect(lignesExport(cr).map((l) => l.nom)).not.toContain('Dépenses perso')
    })
    it('met la catégorie avant ses classeurs, puis les sous-totaux à la fin', () => {
        expect(lignesExport(cr).map((l) => l.type)).toEqual(['categorie', 'classeur', 'classeur', 'total'])
    })
    it('convertit les montants texte en nombres', () => {
        expect(lignesExport(cr)[0]).toMatchObject({ charges: -50, produits: 100, balance: 50 })
    })
})

describe('construireCsv', () => {
    const lignes = construireCsv(cr).split('\r\n')

    it('commence par un BOM et un en-tête séparé par des points-virgules', () => {
        expect(lignes[0]).toBe('\uFEFFCatégorie / Classeur;Charges;Produits;Balance')
    })
    it('écrit les montants avec une virgule décimale', () => {
        expect(lignes[1]).toBe('Événements;-50,00;100,00;50,00')
    })
    it('protège les noms contenant ; ou des guillemets', () => {
        expect(lignes[3]).toBe('"Escape; ""Game""";0,00;0,00;0,00')
    })
    it('ne contient ni le hors CR ni le non classé', () => {
        expect(construireCsv(cr)).not.toMatch(/Dépenses perso|Non classé|HORS CR/)
    })
    it('finit par la ligne SOUS-TOTAUX', () => {
        expect(lignes.at(-1)).toBe('SOUS-TOTAUX;-50,00;100,00;50,00')
    })
})

describe('construireExcel', () => {
    const feuille = async () => (await construireExcel(cr)).getWorksheet('Compte de résultat')

    it('colore en rouge un négatif et en vert un positif', async () => {
        const ligne = (await feuille()).getRow(2)
        expect(ligne.getCell(2).font.color.argb).toBe('FFC62828') // charges -50
        expect(ligne.getCell(3).font.color.argb).toBe('FF2E7D32') // produits 100
    })
    it('met un zéro en noir', async () => {
        expect((await feuille()).getRow(4).getCell(2).font.color.argb).toBe('FF000000')
    })
    it('utilise des couleurs claires sur la ligne SOUS-TOTAUX', async () => {
        const total = (await feuille()).getRow(5)
        expect(total.getCell(1).value).toBe('SOUS-TOTAUX')
        expect(total.getCell(2).font.color.argb).toBe('FFFFB4B4')
        expect(total.getCell(3).font.color.argb).toBe('FFB9F6CA')
    })
    it('contient l\'en-tête, 3 lignes de contenu et les sous-totaux', async () => {
        expect((await feuille()).rowCount).toBe(5)
    })
})