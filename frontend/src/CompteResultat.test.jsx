import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('./api.js', () => ({
    api: vi.fn(),
    euro: (n) => `${Number(n).toFixed(2)} €`,
}))
import { api } from './api.js'
import CompteResultat from './CompteResultat.jsx'

const crBase = (soldeTotalReleve) => ({
    categories: [
        {
            nom: 'Événements', horsCr: false, charges: '-50', produits: '100', balance: '50',
            classeurs: [{ id: 7, nom: 'Galette', charges: '-50', produits: '100', balance: '50' }],
        },
        {
            nom: 'Dépenses perso', horsCr: true, charges: '-10', produits: '0', balance: '-10',
            classeurs: [{ id: 9, nom: 'Divers', charges: '-10', produits: '0', balance: '-10' }],
        },
    ],
    totalCr: { charges: '-50', produits: '100', balance: '50' },
    totalHorsCr: { charges: '-10', produits: '0', balance: '-10' },
    nonClasse: { nb: 2, charges: '-5', produits: '0' },
    soldeTotalReleve, // 50 - 10 - 5 = 35 quand tout concorde
})

const operations = [
    { id: 1, date_operation: '2025-10-05', nature: 'CARTE', libelle: 'Achat', montant: -25.5, commentaire: '', justificatifs: [] },
]

const mockApi = (cr) =>
    api.mockImplementation((url = '') =>
        Promise.resolve(String(url).startsWith('/compte-resultat') ? cr : operations))
beforeEach(() => api.mockReset())

describe('CompteResultat', () => {
    it('affiche les négatifs en rouge et les positifs en vert', async () => {
        mockApi(crBase('35'))
        render(<CompteResultat mandatId={1} />)
        const cellules = (await screen.findByText('Galette')).closest('tr').querySelectorAll('td')
        expect(cellules[1].className).toContain('neg') // charges -50
        expect(cellules[2].className).toContain('pos') // produits 100
        expect(cellules[3].className).toContain('pos') // balance 50
    })

    it('marque hors CR et non classé pour les masquer à l\'impression', async () => {
        mockApi(crBase('35'))
        render(<CompteResultat mandatId={1} />)
        await screen.findByText('Galette')
        expect(screen.getByText('Dépenses perso').closest('tr').className).toContain('hors-print')
        expect(screen.getByText('RESTE HORS CR').closest('tr').className).toContain('hors-print')
        expect(screen.getByText(/Non classé/).closest('tr').className).toContain('hors-print')
        expect(screen.getByText('Événements').closest('tr').className).not.toContain('hors-print')
    })

    it('indique que tout concorde quand le solde correspond', async () => {
        mockApi(crBase('35'))
        render(<CompteResultat mandatId={1} />)
        expect(await screen.findByText(/tout concorde/)).toBeTruthy()
    })

    it('signale un écart quand le solde ne correspond pas', async () => {
        mockApi(crBase('40'))
        render(<CompteResultat mandatId={1} />)
        expect(await screen.findByText(/écart de 5\.00/)).toBeTruthy()
    })

    it('ouvre le détail d\'un classeur au clic, avec ses transactions', async () => {
        mockApi(crBase('35'))
        render(<CompteResultat mandatId={1} />)
        fireEvent.click((await screen.findByText('Galette')).closest('tr'))
        expect(await screen.findByText(/1 transactions/)).toBeTruthy()
        expect(api).toHaveBeenCalledWith('/operations?mandatId=1&classeurId=7')
        expect(screen.getByText('Achat')).toBeTruthy()
    })

    it('le menu Télécharger propose PDF, Excel et CSV', async () => {
        mockApi(crBase('35'))
        render(<CompteResultat mandatId={1} />)
        fireEvent.click(await screen.findByText(/Télécharger/))
        expect(screen.getByText(/PDF/)).toBeTruthy()
        expect(screen.getByText(/Excel/)).toBeTruthy()
        expect(screen.getByText(/CSV/)).toBeTruthy()
    })
})