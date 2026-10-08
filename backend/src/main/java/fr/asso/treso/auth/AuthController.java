package fr.asso.treso.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(String username, String password) {}
    public record Me(String username, String displayName) {}

    private static final int MAX_ATTEMPTS = 5;
    private static final long WINDOW_MS = 10 * 60 * 1000;

    private final NextcloudAuthService nextcloud;
    private final SecurityContextRepository repo;
    // clé = ip|identifiant -> [nb d'échecs, début de fenêtre]
    private final Map<String, long[]> failures = new ConcurrentHashMap<>();

    public AuthController(NextcloudAuthService nextcloud, SecurityContextRepository repo) {
        this.nextcloud = nextcloud;
        this.repo = repo;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest body,
                                   HttpServletRequest request, HttpServletResponse response) {
        String username = body.username() == null ? "" : body.username().trim();
        String password = body.password() == null ? "" : body.password();
        if (username.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Identifiant et mot de passe requis."));
        }

        String key = request.getRemoteAddr() + "|" + username.toLowerCase();
        if (isBlocked(key)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("message", "Trop de tentatives. Réessayez dans quelques minutes."));
        }

        NextcloudAuthService.NextcloudUser user;
        try {
            user = nextcloud.authenticate(username, password).orElse(null);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Nextcloud est injoignable pour le moment."));
        }

        if (user == null) {
            registerFailure(key);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Identifiants Nextcloud invalides ou accès non autorisé."));
        }
        failures.remove(key);

        if (request.getSession(false) != null) request.changeSessionId(); // anti session-fixation

        Authentication auth = new UsernamePasswordAuthenticationToken(
                user.id(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);
        repo.saveContext(ctx, request, response);
        request.getSession().setAttribute("displayName", user.displayName());

        return ResponseEntity.ok(new Me(user.id(), user.displayName()));
    }

    @GetMapping("/me")
    public Me me(Authentication auth, HttpSession session) {
        String display = (String) session.getAttribute("displayName");
        return new Me(auth.getName(), display != null ? display : auth.getName());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession s = request.getSession(false);
        if (s != null) s.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    private boolean isBlocked(String key) {
        long[] f = failures.get(key);
        if (f == null) return false;
        if (System.currentTimeMillis() - f[1] > WINDOW_MS) { failures.remove(key); return false; }
        return f[0] >= MAX_ATTEMPTS;
    }

    private void registerFailure(String key) {
        failures.merge(key, new long[]{1, System.currentTimeMillis()},
                (old, n) -> new long[]{old[0] + 1, old[1]});
    }
}