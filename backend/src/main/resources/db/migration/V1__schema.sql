CREATE TABLE mandat (
    id     SERIAL PRIMARY KEY,
    nom    VARCHAR(50) NOT NULL UNIQUE,      -- ex : '2025 - 2026'
    debut  DATE NOT NULL,
    fin    DATE NOT NULL
);

-- Catégories : communes à tous les mandats (Événements, Fonctionnement...)
CREATE TABLE categorie (
    id      SERIAL PRIMARY KEY,
    nom     VARCHAR(100) NOT NULL UNIQUE,
    hors_cr BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = "Hors Compte de Résultats"
    ordre   INT NOT NULL DEFAULT 0
);

-- Classeurs : propres à un mandat, rattachés à une catégorie (Escape Game, Galette des Rois...)
CREATE TABLE classeur (
    id           SERIAL PRIMARY KEY,
    mandat_id    INT NOT NULL REFERENCES mandat(id),
    categorie_id INT NOT NULL REFERENCES categorie(id),
    nom          VARCHAR(150) NOT NULL,
    UNIQUE (mandat_id, nom)
);

-- Lignes du relevé de compte. montant < 0 = charge, > 0 = produit
CREATE TABLE operation (
    id             BIGSERIAL PRIMARY KEY,
    mandat_id      INT NOT NULL REFERENCES mandat(id),
    date_operation DATE NOT NULL,
    libelle        TEXT NOT NULL,
    montant        NUMERIC(12,2) NOT NULL,
    classeur_id    INT REFERENCES classeur(id),   -- NULL = à classer
    empreinte      VARCHAR(64) NOT NULL UNIQUE,   -- évite les doublons si on ré-importe un fichier
    created_at     TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_operation_mandat ON operation(mandat_id, date_operation);

-- Justificatifs : le fichier est dans Nextcloud, on garde seulement son chemin
CREATE TABLE justificatif (
    id           BIGSERIAL PRIMARY KEY,
    operation_id BIGINT NOT NULL REFERENCES operation(id) ON DELETE CASCADE,
    nom          TEXT NOT NULL,
    chemin       TEXT NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT now()
);
