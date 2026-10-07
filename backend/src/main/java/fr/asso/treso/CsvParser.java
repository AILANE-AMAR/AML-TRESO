package fr.asso.treso;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.IOException;
import java.io.StringReader;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Lit un relevé bancaire CSV (séparateur ; ou ,). Tolérant : cherche tout seul la ligne d'en-tête
 * et les colonnes Date / Libellé / Montant (ou Débit + Crédit).
 */
public final class CsvParser {

    public record Ligne(LocalDate date, String libelle, String nature, BigDecimal montant) {}
    private static final List<DateTimeFormatter> DATES = List.of(
            DateTimeFormatter.ofPattern("dd/MM/yyyy"), DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"), DateTimeFormatter.ofPattern("dd/MM/yy"));

    private CsvParser() {}

    public static List<Ligne> parse(byte[] data) throws IOException {
        List<String> lines = decode(data).lines().toList();
        int h = -1;
        for (int i = 0; i < lines.size(); i++) {
            String n = norm(lines.get(i));
            if (n.contains("date") && (n.contains("montant") || n.contains("debit") || n.contains("credit"))) { h = i; break; }
        }
        if (h < 0) throw new IllegalArgumentException(
                "En-tête introuvable : le CSV doit avoir une colonne Date et une colonne Montant (ou Débit / Crédit).");

        String header = lines.get(h);
        char sep = count(header, ';') >= count(header, ',') ? ';' : ',';
        String body = String.join("\n", lines.subList(h, lines.size()));

        List<Ligne> result = new ArrayList<>();
        try (CSVParser p = CSVFormat.DEFAULT.builder().setDelimiter(sep).setHeader().setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true).setTrim(true).build().parse(new StringReader(body))) {
            List<String> names = p.getHeaderNames();
            String cDate = pick(names, "date", "operation");
            String cLib = pick(names, "motif", "libelle", "label", "detail", "description");
            String cMontant = pick(names, "montant");
            String cNature = pick(names, "nature");
            String cDebit = pick(names, "debit");
            String cCredit = pick(names, "credit");
            if (cDate == null || cLib == null) throw new IllegalArgumentException("Colonnes Date et Libellé introuvables.");

            for (CSVRecord r : p) {
                String d = get(r, cDate);
                if (d.isBlank()) {
                    // ligne de suite (POUR:, REF:, MOTIF:...) : on rattache le motif à la transaction précédente
                    if (!result.isEmpty()) {
                        for (String cell : r) {
                            var m = MOTIF.matcher(cell.trim());
                            if (m.matches() && !m.group(1).isBlank()) {
                                Ligne l = result.remove(result.size() - 1);
                                result.add(new Ligne(l.date(), m.group(1).trim(), l.nature(), l.montant()));                            }
                        }
                    }
                    continue;
                }
                BigDecimal montant = null;
                if (cMontant != null && !get(r, cMontant).isBlank()) montant = amount(get(r, cMontant));
                else {
                    if (cDebit != null && !get(r, cDebit).isBlank()) montant = amount(get(r, cDebit)).abs().negate();
                    if (cCredit != null && !get(r, cCredit).isBlank()) montant = amount(get(r, cCredit)).abs();
                }
                if (montant == null) continue;
                result.add(new Ligne(date(d), motif(get(r, cLib)), cNature == null ? "" : get(r, cNature), montant));           }
        }
        return result;
    }

    private static final java.util.regex.Pattern MOTIF =
            java.util.regex.Pattern.compile("(?i)^motif\\s*:\\s*(.*)$");

    /** Dans la cellule multi-lignes, garde ce qui suit "MOTIF:". Sinon, la première ligne. */
    static String motif(String texte) {
        String premiere = null;
        for (String ligne : texte.split("\\R")) {
            String t = ligne.trim();
            if (t.isEmpty()) continue;
            if (premiere == null) premiere = t;
            var m = MOTIF.matcher(t);
            if (m.matches() && !m.group(1).isBlank()) return m.group(1).trim();
        }
        return premiere == null ? "" : premiere;
    }
    private static String get(CSVRecord r, String col) { return r.isSet(col) ? r.get(col) : ""; }

    private static String pick(List<String> names, String key, String prefer) {
        String first = null;
        for (String n : names) if (norm(n).contains(key)) {
            if (prefer != null && norm(n).contains(prefer)) return n;
            if (first == null) first = n;
        }
        return first;
    }
    private static String pick(List<String> names, String... keys) {
        for (String k : keys) { String f = pick(names, k, null); if (f != null) return f; }
        return null;
    }

    static BigDecimal amount(String s) {
        String t = s.replace("\u00a0", "").replace(" ", "").replace("€", "").replace(",", ".");
        return new BigDecimal(t);
    }

    static LocalDate date(String s) {
        for (DateTimeFormatter f : DATES) {
            try { return LocalDate.parse(s.trim(), f); } catch (Exception ignored) {}
        }
        throw new IllegalArgumentException("Date non reconnue : " + s);
    }

    private static String decode(byte[] data) {
        String s;
        try {
            s = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString();
        } catch (CharacterCodingException e) {
            s = new String(data, StandardCharsets.ISO_8859_1); // beaucoup de banques exportent en Latin-1
        }
        return s.startsWith("\uFEFF") ? s.substring(1) : s;
    }

    private static long count(String s, char c) { return s.chars().filter(x -> x == c).count(); }

    private static String norm(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase().trim();
    }
}
