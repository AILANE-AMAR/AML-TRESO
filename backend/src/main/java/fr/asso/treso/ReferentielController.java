package fr.asso.treso;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Mandats, catégories, classeurs. */
@RestController
@RequestMapping("/api")
public class ReferentielController {

    private final JdbcClient db;
    public ReferentielController(JdbcClient db) { this.db = db; }

    public record NouveauMandat(String nom, LocalDate debut, LocalDate fin, Integer copierClasseursDe) {}
    public record NouveauClasseur(int mandatId, int categorieId, String nom) {}

    @GetMapping("/mandats")
    public List<Map<String, Object>> mandats() {
        return db.sql("SELECT id, nom, debut, fin FROM mandat ORDER BY debut DESC").query().listOfRows();
    }

    @PostMapping("/mandats")
    public Map<String, Object> creerMandat(@RequestBody NouveauMandat m) {
        Integer id = db.sql("INSERT INTO mandat(nom, debut, fin) VALUES (?,?,?) RETURNING id")
                .params(m.nom().trim(), m.debut(), m.fin()).query(Integer.class).single();
        if (m.copierClasseursDe() != null) { // reprend la structure d'un ancien mandat
            db.sql("INSERT INTO classeur(mandat_id, categorie_id, nom) SELECT ?, categorie_id, nom FROM classeur WHERE mandat_id = ?")
                    .params(id, m.copierClasseursDe()).update();
        }
        return Map.of("id", id);
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories() {
        return db.sql("SELECT id, nom, hors_cr FROM categorie ORDER BY ordre").query().listOfRows();
    }

    @GetMapping("/classeurs")
    public List<Map<String, Object>> classeurs(@RequestParam int mandatId) {
        return db.sql("""
                SELECT cl.id, cl.nom, c.id AS categorie_id, c.nom AS categorie_nom
                FROM classeur cl JOIN categorie c ON c.id = cl.categorie_id
                WHERE cl.mandat_id = ? ORDER BY c.ordre, cl.nom""").param(mandatId).query().listOfRows();
    }

    @PostMapping("/classeurs")
    public Map<String, Object> creerClasseur(@RequestBody NouveauClasseur c) {
        Integer id = db.sql("INSERT INTO classeur(mandat_id, categorie_id, nom) VALUES (?,?,?) RETURNING id")
                .params(c.mandatId(), c.categorieId(), c.nom().trim()).query(Integer.class).single();
        return Map.of("id", id);
    }
}
