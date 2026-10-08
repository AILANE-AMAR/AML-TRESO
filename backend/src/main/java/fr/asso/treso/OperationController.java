package fr.asso.treso;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/**
 * Transactions (relevé bancaire) + justificatifs.
 */
@RestController
@RequestMapping("/api")
public class OperationController {

    private final JdbcClient db;
    private final NextcloudService nextcloud;

    public OperationController(JdbcClient db, NextcloudService nextcloud) {
        this.db = db;
        this.nextcloud = nextcloud;
    }

    public record Classement(Integer classeurId) {
    }

    @GetMapping("/operations")
    public List<Map<String, Object>> liste(@RequestParam int mandatId,
                                           @RequestParam(required = false) String mois,      // ex : 2025-11
                                           @RequestParam(defaultValue = "false") boolean aClasser) {
        StringBuilder sql = new StringBuilder(
                "SELECT id, date_operation, libelle, nature, montant, classeur_id , commentaire FROM operation WHERE mandat_id = ?");
        List<Object> p = new ArrayList<>(List.of(mandatId));
        if (mois != null && !mois.isBlank()) {
            sql.append(" AND to_char(date_operation,'YYYY-MM') = ?");
            p.add(mois);
        }
        if (aClasser) sql.append(" AND classeur_id IS NULL");
        sql.append(" ORDER BY date_operation DESC, id DESC");

        List<Map<String, Object>> ops = db.sql(sql.toString()).params(p).query().listOfRows();

        Map<Object, List<Map<String, Object>>> justifs = new HashMap<>();
        for (var j : db.sql("""
                        SELECT j.id, j.operation_id, j.nom FROM justificatif j
                        JOIN operation o ON o.id = j.operation_id WHERE o.mandat_id = ? ORDER BY j.id""")
                .param(mandatId).query().listOfRows()) {
            justifs.computeIfAbsent(j.get("operation_id"), k -> new ArrayList<>()).add(j);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (var o : ops) {
            Map<String, Object> m = new LinkedHashMap<>(o);
            m.put("justificatifs", justifs.getOrDefault(o.get("id"), List.of()));
            out.add(m);
        }
        return out;
    }

    /**
     * Import d'un CSV de relevé. Ré-importer le même fichier ne crée pas de doublons.
     */
    @PostMapping("/operations/import")
    public Map<String, Object> importer(@RequestParam int mandatId, @RequestParam MultipartFile file) {
        List<CsvParser.Ligne> lignes;
        try {
            lignes = CsvParser.parse(file.getBytes());
        } catch (IllegalArgumentException | IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }

        int ajoutees = 0;
        Map<String, Integer> occurrences = new HashMap<>(); // 2 lignes identiques le même jour restent distinctes
        for (var l : lignes) {
            String base = mandatId + "|" + l.date() + "|" + l.libelle() + "|" + l.montant();
            int n = occurrences.merge(base, 1, Integer::sum);
            ajoutees += db.sql("""
                            INSERT INTO operation(mandat_id, date_operation, libelle, nature, montant, empreinte)
                            VALUES (?,?,?,?,?,?) ON CONFLICT (empreinte) DO NOTHING""")
                    .params(mandatId, l.date(), l.libelle(), l.nature(), l.montant(), sha256(base + "|" + n)).update();
        }
        return Map.of("lues", lignes.size(), "ajoutees", ajoutees, "doublonsIgnores", lignes.size() - ajoutees);
    }

    public record Modification(Integer classeurId, String commentaire) {}

    @PutMapping("/operations/{id}")
    public void modifier(@PathVariable long id, @RequestBody Modification m) {
        db.sql("UPDATE operation SET classeur_id = ?, commentaire = ? WHERE id = ?")
                .params(m.classeurId(), m.commentaire(), id).update();
    }

    @DeleteMapping("/operations/{id}")
    public void supprimer(@PathVariable long id) {
        db.sql("DELETE FROM operation WHERE id = ?").param(id).update();
    }

    /**
     * Ajoute un justificatif : le fichier part dans Nextcloud, rangé par mandat / catégorie / classeur.
     */
    @PostMapping("/operations/{id}/justificatifs")
    public Map<String, Object> ajouterJustificatif(@PathVariable long id, @RequestParam MultipartFile file) throws IOException {
        var o = db.sql("""
                SELECT o.date_operation, m.nom AS mandat, c.nom AS categorie, cl.nom AS classeur
                FROM operation o JOIN mandat m ON m.id = o.mandat_id
                LEFT JOIN classeur cl ON cl.id = o.classeur_id
                LEFT JOIN categorie c ON c.id = cl.categorie_id
                WHERE o.id = ?""").param(id).query().singleRow();
        if (o.get("classeur") == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Classe d'abord la transaction dans un classeur.");

        String nom = o.get("date_operation") + "_op" + id + "_" + file.getOriginalFilename();
        String chemin;
        try {
            chemin = nextcloud.envoyer(
                    List.of(
                            (String) o.get("mandat"),
                            "[3] Trésorerie",
                            (String) o.get("categorie"),
                            (String) o.get("classeur")
                    ),
                    nom,
                    file.getBytes()
            );
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Envoi vers Nextcloud impossible : " + e.getMessage());
        }
        Long jid = db.sql("INSERT INTO justificatif(operation_id, nom, chemin) VALUES (?,?,?) RETURNING id")
                .params(id, file.getOriginalFilename(), chemin).query(Long.class).single();
        return Map.of("id", jid);
    }

    @GetMapping("/justificatifs/{id}")
    public ResponseEntity<byte[]> telecharger(@PathVariable long id) {
        var j = db.sql("SELECT nom, chemin FROM justificatif WHERE id = ?").param(id).query().singleRow();
        byte[] data = nextcloud.lire((String) j.get("chemin"));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + j.get("nom") + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM).body(data);
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
