package fr.asso.treso;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Envoie / lit les justificatifs dans Nextcloud via WebDAV. */
@Service
public class NextcloudService {

    private final RestClient http;
    private final String root;

    public NextcloudService(@Value("${nextcloud.url}") String url,
                            @Value("${nextcloud.user}") String user,
                            @Value("${nextcloud.password}") String password) {
        this.root = url.replaceAll("/+$", "") + "/remote.php/dav/files/" + enc(user);
        this.http = RestClient.builder().defaultHeaders(h -> h.setBasicAuth(user, password)).build();
    }

    /** Crée les dossiers manquants puis dépose le fichier. Retourne le chemin (encodé) à stocker en base. */
    public String envoyer(List<String> dossiers, String nomFichier, byte[] contenu) {
        StringBuilder path = new StringBuilder();
        for (String d : dossiers) {
            path.append('/').append(enc(clean(d)));
            // MKCOL : 201 = créé, 405 = existe déjà -> on ignore les deux
            http.method(HttpMethod.valueOf("MKCOL")).uri(URI.create(root + path))
                    .exchange((req, res) -> res.getStatusCode().value());
        }
        path.append('/').append(enc(clean(nomFichier)));
        http.put().uri(URI.create(root + path)).body(contenu).retrieve().toBodilessEntity();
        return path.toString();
    }

    public byte[] lire(String chemin) {
        return http.get().uri(URI.create(root + chemin)).retrieve().body(byte[].class);
    }

    private static String enc(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20"); }
    private static String clean(String s) { return s.replaceAll("[\\\\/:*?\"<>|]", "-").trim(); }
}
