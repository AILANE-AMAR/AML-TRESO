import { useEffect, useState } from 'react'
import { api, euro } from './api.js'

const Ligne = ({ nom, charges, produits, balance, classe = '', indent }) => (
  <tr className={classe}>
    <td style={{ paddingLeft: indent ? 28 : 8 }}>{nom}</td>
    <td className="num">{euro(charges)}</td><td className="num">{euro(produits)}</td>
    <td className={'num ' + (balance < 0 ? 'neg' : 'pos')}>{euro(balance)}</td>
  </tr>
)

export default function CompteResultat({ mandatId }) {
  const [cr, setCr] = useState(null)
  useEffect(() => { api('/compte-resultat?mandatId=' + mandatId).then(setCr) }, [mandatId])
  if (!cr) return <p>Chargement…</p>

  const dans = cr.categories.filter((c) => !c.horsCr)
  const hors = cr.categories.filter((c) => c.horsCr)
  const bloc = (c) => [
    <Ligne key={c.nom} {...c} classe="categorie" />,
    ...c.classeurs.map((k) => <Ligne key={c.nom + k.nom} {...k} indent />),
  ]
  const ecart = Number(cr.soldeTotalReleve) - (Number(cr.totalCr.balance) + Number(cr.totalHorsCr.balance) + Number(cr.nonClasse.charges) + Number(cr.nonClasse.produits))

  return (
    <section>
      <table>
        <thead><tr><th>Catégorie / Classeur</th><th className="num">Charges</th><th className="num">Produits</th><th className="num">Balance</th></tr></thead>
        <tbody>
          {dans.flatMap(bloc)}
          <Ligne nom="SOUS-TOTAL COMPTE DE RÉSULTAT" {...cr.totalCr} classe="total" />
          {hors.flatMap(bloc)}
          <Ligne nom="RESTE HORS CR" {...cr.totalHorsCr} classe="total" />
          <Ligne nom={`Non classé (${cr.nonClasse.nb} lignes)`} charges={cr.nonClasse.charges} produits={cr.nonClasse.produits}
            balance={Number(cr.nonClasse.charges) + Number(cr.nonClasse.produits)} classe="aclasser" />
        </tbody>
      </table>
      <p className="msg">Solde total du relevé : {euro(cr.soldeTotalReleve)} — contrôle : {Math.abs(ecart) < 0.005 ? '✅ tout concorde' : '⚠️ écart de ' + euro(ecart)}</p>
    </section>
  )
}
