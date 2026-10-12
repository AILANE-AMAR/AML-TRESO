package fr.asso.treso.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class NextcloudAuthService {

    public record NextcloudUser(String id, String displayName) {}

    private final RestClient client;
    private final String requiredGroup;
    private final ObjectMapper mapper = new ObjectMapper();

    public NextcloudAuthService(@Value("${nextcloud.url}") String url,
                                @Value("${nextcloud.required-group:}") String requiredGroup) {
        String base = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        this.client = RestClient.builder()
                .baseUrl(base)
                .defaultHeader("OCS-APIRequest", "true")
                .build();
        this.requiredGroup = requiredGroup == null ? "" : requiredGroup.trim();
    }

    /** Retourne l'utilisateur si les identifiants Nextcloud sont valides (et groupe OK), sinon vide. */
    public Optional<NextcloudUser> authenticate(String username, String password) {
        try {
            String body = client.get()
                    .uri("/ocs/v2.php/cloud/user?format=json")
                    .headers(h -> h.setBasicAuth(username, password, StandardCharsets.UTF_8))
                    .retrieve()
                    .body(String.class);

            JsonNode data = mapper.readTree(body).path("ocs").path("data");
            String id = data.path("id").asText("");
            if (id.isEmpty()) return Optional.empty();

            if (!requiredGroup.isEmpty()) {
                List<String> groups = new ArrayList<>();
                data.path("groups").forEach(g -> groups.add(g.asText()));
                if (!groups.contains(requiredGroup)) return Optional.empty();
            }
            String display = data.path("displayname").asText(id);
            return Optional.of(new NextcloudUser(id, display));

        } catch (HttpClientErrorException e) {
            System.err.println("NEXTCLOUD STATUT : " + e.getStatusCode() + " " + e.getResponseBodyAsString());
            HttpStatusCode s = e.getStatusCode();
            if (s.value() == 401 || s.value() == 403 || s.value() == 997) return Optional.empty();
            throw new IllegalStateException("Nextcloud a répondu " + s.value(), e);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            System.err.println("ERREUR NEXTCLOUD : " + e);
            e.printStackTrace();
            throw new IllegalStateException("Nextcloud injoignable", e);
        }
    }
}