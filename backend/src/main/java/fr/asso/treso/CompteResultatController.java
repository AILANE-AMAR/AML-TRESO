package fr.asso.treso;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/** Compte de résultat d'un mandat : Catégorie > Classeur, avec Charges / Produits / Balance. */
@RestController
@RequestMapping("/api")
public class CompteResultatController {

    private final JdbcClient db;
    public CompteResultatController(JdbcClient db) { this.db = db; }

    @GetMapping("/compte-resultat")
    public Map<String, Object> compteResultat(@RequestParam int mandatId) {
        // Une seule requête, facile à vérifier : charges = montants < 0, produits = montants > 0
        var rows = db.sql("""
                SELECT c.id AS categorie_id, c.nom AS categorie, c.hors_cr, cl.id AS classeur_id, cl.nom AS classeur,
                       COALESCE(SUM(o.montant) FILTER (WHERE o.montant < 0), 0) AS charges,
                       COALESCE(SUM(o.montant) FILTER (WHERE o.montant > 0), 0) AS produits,
                       COUNT(o.id) AS nb
                FROM classeur cl
                JOIN categorie c ON c.id = cl.categorie_id
                LEFT JOIN operation o ON o.classeur_id = cl.id
                WHERE cl.mandat_id = ?
                GROUP BY c.id, c.nom, c.hors_cr, c.ordre, cl.id, cl.nom
                ORDER BY c.ordre, cl.nom""").param(mandatId).query().listOfRows();

        Map<Object, Map<String, Object>> cats = new LinkedHashMap<>();
        for (var r : rows) {
            var cat = cats.computeIfAbsent(r.get("categorie_id"), k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("nom", r.get("categorie")); m.put("horsCr", r.get("hors_cr"));
                m.put("charges", BigDecimal.ZERO); m.put("produits", BigDecimal.ZERO);
                m.put("classeurs", new ArrayList<Map<String, Object>>());
                return m;
            });
            BigDecimal ch = (BigDecimal) r.get("charges"), pr = (BigDecimal) r.get("produits");
            cat.put("charges", ((BigDecimal) cat.get("charges")).add(ch));
            cat.put("produits", ((BigDecimal) cat.get("produits")).add(pr));
            @SuppressWarnings("unchecked") var list = (List<Map<String, Object>>) cat.get("classeurs");
            list.add(Map.of("id", r.get("classeur_id"), "nom", r.get("classeur"), "charges", ch, "produits", pr,
                    "balance", ch.add(pr), "nb", r.get("nb")));        }
        BigDecimal chCr = BigDecimal.ZERO, prCr = BigDecimal.ZERO, chHors = BigDecimal.ZERO, prHors = BigDecimal.ZERO;
        for (var cat : cats.values()) {
            cat.put("balance", ((BigDecimal) cat.get("charges")).add((BigDecimal) cat.get("produits")));
            boolean hors = (boolean) cat.get("horsCr");
            if (hors) { chHors = chHors.add((BigDecimal) cat.get("charges")); prHors = prHors.add((BigDecimal) cat.get("produits")); }
            else { chCr = chCr.add((BigDecimal) cat.get("charges")); prCr = prCr.add((BigDecimal) cat.get("produits")); }
        }
        var nonClasse = db.sql("""
                SELECT COALESCE(SUM(montant) FILTER (WHERE montant < 0), 0) AS charges,
                       COALESCE(SUM(montant) FILTER (WHERE montant > 0), 0) AS produits, COUNT(*) AS nb
                FROM operation WHERE mandat_id = ? AND classeur_id IS NULL""").param(mandatId).query().singleRow();
        BigDecimal soldeTotal = db.sql("SELECT COALESCE(SUM(montant),0) FROM operation WHERE mandat_id = ?")
                .param(mandatId).query(BigDecimal.class).single();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("categories", cats.values());
        out.put("totalCr", Map.of("charges", chCr, "produits", prCr, "balance", chCr.add(prCr)));
        out.put("totalHorsCr", Map.of("charges", chHors, "produits", prHors, "balance", chHors.add(prHors)));
        out.put("nonClasse", nonClasse);
        out.put("soldeTotalReleve", soldeTotal); // doit = CR + hors CR + non classé
        return out;
    }
}
