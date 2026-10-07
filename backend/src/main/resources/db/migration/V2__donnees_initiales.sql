INSERT INTO categorie(nom, hors_cr, ordre) VALUES
 ('Événements', false, 1), ('Fonctionnement', false, 2), ('Local', false, 3),
 ('Non Catégorisé', false, 4), ('Partenariats', false, 5), ('Reliquats', false, 6),
 ('Hors Compte de Résultats', true, 7);

INSERT INTO mandat(nom, debut, fin) VALUES ('2025 - 2026', '2025-09-01', '2026-08-31');

INSERT INTO classeur(mandat_id, categorie_id, nom)
SELECT m.id, c.id, v.classeur
FROM mandat m
CROSS JOIN (VALUES
 ('Événements','Escape Game'), ('Événements','Gala Fin d''année AML'), ('Événements','Galette des Rois'),
 ('Événements','Remise des Diplômes'), ('Événements','Vente de crèpes'), ('Événements','Vente de panini'),
 ('Fonctionnement','Adhésion'), ('Fonctionnement','Adhésions Organismes Extérieurs'), ('Fonctionnement','Assurance'),
 ('Fonctionnement','Dons'), ('Fonctionnement','Frais / Cotisations / Abonnements'), ('Fonctionnement','Subventions'),
 ('Fonctionnement','Vol'),
 ('Local','Matériel'), ('Local','Pharmacie'), ('Local','Vente au local'),
 ('Non Catégorisé','Retrait especes'),
 ('Partenariats','Pulls du bureau'),
 ('Reliquats','Adhésions'), ('Reliquats','Gala N-1'), ('Reliquats','Vente au local N-1'), ('Reliquats','Vente bubble tea'),
 ('Hors Compte de Résultats','Mouvement interne')
) AS v(cat, classeur)
JOIN categorie c ON c.nom = v.cat
WHERE m.nom = '2025 - 2026';
