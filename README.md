# Trésorerie – Application web pour une association

Application de gestion de trésorerie pour une association étudiante : import des relevés bancaires, classement des transactions par mandat, compte de résultat automatique et stockage des justificatifs dans Nextcloud.

Projet réel, conçu à partir des besoins du bureau (non techniciens) : cotisations, dépenses, recettes, soldes et bilans vérifiables.

## Fonctionnalités

- **Import des relevés CSV** (un fichier par mois), avec lecture automatique des colonnes Date, Nature, Motif, Débit / Crédit.
- **Anti-doublons** : une ligne est ignorée si une transaction avec la même date et le même montant existe déjà dans le mandat.
- **Classement par mandat** : chaque transaction est rangée dans un *Dossier* (catégorie) et une *Étiquette* (classeur), avec un commentaire.
- **Compte de résultat** par mandat : Catégorie › Classeur, avec Charges, Produits et Balance, un bloc « Hors compte de résultat » et un contrôle de cohérence avec le solde du relevé.
- **Justificatifs** : chaque fichier ajouté à une transaction est envoyé dans Nextcloud, rangé dans `Tresorerie/<mandat>/<catégorie>/<classeur>/`.
- **Gestion des mandats** : création d'un nouveau mandat en reprenant les classeurs du précédent.

## Technologies

| Partie | Outils |
|---|---|
| Backend | Java 17, Spring Boot 3.3, JDBC (`JdbcClient`), Flyway, Apache Commons CSV |
| Base de données | PostgreSQL 16 (Docker) |
| Frontend | React 18, Vite |
| Justificatifs | Nextcloud (WebDAV) |

## Structure du projet

```
tresorerie-asso/
├── docker-compose.yml          # PostgreSQL
├── backend/
│   ├── pom.xml
│   └── src/main/
│       ├── java/fr/asso/treso/
│       │   ├── TresoApplication.java
│       │   ├── CsvParser.java               # lecture des relevés CSV
│       │   ├── OperationController.java     # transactions, import, justificatifs
│       │   ├── CompteResultatController.java
│       │   ├── ReferentielController.java   # mandats, catégories, classeurs
│       │   └── NextcloudService.java        # envoi / lecture WebDAV
│       └── resources/
│           ├── application.yml
│           └── db/migration/                # scripts SQL Flyway (V1 à V4)
└── frontend/
    └── src/                                 # pages React
```

## Modèle de données

- `mandat` : période de gestion (ex. 2025 - 2026).
- `categorie` : Événements, Fonctionnement, Local, etc. Communes à tous les mandats. Une catégorie peut être « hors compte de résultat ».
- `classeur` : rattaché à un mandat et à une catégorie (Escape Game, Galette des Rois…).
- `operation` : ligne du relevé. Un montant négatif est une charge, un montant positif est un produit.
- `justificatif` : chemin du fichier stocké dans Nextcloud.

Le schéma est créé et mis à jour automatiquement par Flyway au démarrage.

## Prérequis

- Java 17 et IntelliJ IDEA (ou Maven)
- Node.js 18 ou plus
- Docker (pour PostgreSQL)
- Un Nextcloud accessible, avec un mot de passe d'application (Nextcloud › Paramètres personnels › Sécurité)

## Installation

### 1. Base de données

```bash
docker compose up -d
```

PostgreSQL est exposé sur le port **5433** de la machine (base, utilisateur et mot de passe : `treso`).

### 2. Configuration de Nextcloud

Dans `backend/src/main/resources/application.yml`, bloc `nextcloud` :

```yaml
nextcloud:
  url: ${NEXTCLOUD_URL}
  user: ${NEXTCLOUD_USER}
  password: ${NEXTCLOUD_PASSWORD}
```

- `url` : adresse de base du Nextcloud, sans `/remote.php/...` (ex. `https://cloud.exemple.fr`).
- `user` : identifiant Nextcloud (pas l'e-mail).
- `password` : mot de passe d'application.

Dans IntelliJ : *Run › Edit Configurations › TresoApplication › Environment variables*, puis :

```
NEXTCLOUD_URL=https://cloud.exemple.fr;NEXTCLOUD_USER=identifiant;NEXTCLOUD_PASSWORD=mot-de-passe-application
```

> ⚠️ Ne jamais écrire le mot de passe Nextcloud en clair dans un fichier versionné.

### 3. Backend

Ouvrir le dossier `backend` dans IntelliJ (projet Maven) et lancer `TresoApplication`.
L'API écoute sur http://localhost:8080. Au premier démarrage, Flyway crée les tables et charge les catégories et classeurs du mandat 2025 - 2026.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173. Les appels `/api` sont redirigés vers le backend (voir `vite.config.js`).

## Utilisation

1. **Transactions › Importer un relevé CSV** : choisir le fichier du mois. Le message d'import indique le nombre de lignes ajoutées et de doublons ignorés.
2. **Modifier** sur une ligne : choisir le dossier (catégorie), l'étiquette (classeur), ajouter un commentaire et des justificatifs.
3. **Compte de résultat** : consulter les charges, produits et balances par catégorie et classeur. Les lignes non classées apparaissent à part.
4. **Réglages** : créer un nouveau mandat (avec reprise des classeurs) ou ajouter un classeur.

## Format du fichier CSV

- Séparateur `;` ou `,`, encodage UTF-8 ou Latin-1.
- Une ligne d'en-tête avec une colonne **Date** et une colonne **Montant**, ou **Débit** + **Crédit**.
- Dates au format `jj/mm/aaaa`.
- Colonne **Nature** (type d'opération, ex. `CARTE X448…`, `VIR RECU`).
- Le **motif** est lu après `MOTIF:` quand il est présent dans les lignes de suite du relevé. Sinon, c'est le libellé de la colonne qui est utilisé.

Un autre format de banque se règle dans `CsvParser.java`.

## API REST

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/mandats` | Liste des mandats |
| POST | `/api/mandats` | Créer un mandat (option : copier les classeurs d'un autre) |
| GET | `/api/categories` | Liste des catégories |
| GET / POST | `/api/classeurs` | Classeurs d'un mandat / création |
| GET | `/api/operations` | Transactions (filtres : mandat, mois, à classer) |
| POST | `/api/operations/import` | Import d'un CSV |
| PUT | `/api/operations/{id}` | Modifier classeur et commentaire |
| DELETE | `/api/operations/{id}` | Supprimer une transaction |
| POST | `/api/operations/{id}/justificatifs` | Ajouter un justificatif (Nextcloud) |
| GET | `/api/justificatifs/{id}` | Télécharger un justificatif |
| GET | `/api/compte-resultat` | Compte de résultat d'un mandat |

## Vérifier les chiffres en SQL

```sql
SELECT c.nom AS categorie, cl.nom AS classeur,
       SUM(o.montant) FILTER (WHERE o.montant < 0) AS charges,
       SUM(o.montant) FILTER (WHERE o.montant > 0) AS produits
FROM operation o
JOIN classeur cl ON cl.id = o.classeur_id
JOIN categorie c ON c.id = cl.categorie_id
WHERE o.mandat_id = 1
GROUP BY c.nom, cl.nom;
```

## Dépannage

- **La liste « Mandat » est vide / erreurs `ECONNREFUSED` dans le terminal de Vite** : lancer `npm run dev` dans le même environnement que le backend (par exemple PowerShell sous Windows, et non WSL si le backend tourne sous Windows).
- **`Failed to obtain JDBC Connection`** : la base est arrêtée. Relancer `docker compose up -d` et redémarrer le backend.
- **« Envoi vers Nextcloud impossible »** : vérifier l'URL, l'identifiant et le mot de passe d'application.
- **`application.yml` modifié** : redémarrer le backend, le fichier n'est lu qu'au démarrage.

## Limites actuelles

- Pas d'authentification : ne pas exposer l'application sur Internet en l'état.
- Supprimer une transaction ou changer son classeur ne déplace ni ne supprime les fichiers déjà envoyés dans Nextcloud.
- La détection des doublons se base uniquement sur la date et le montant.

## Pistes d'évolution

- Connexion par mot de passe et rôles (trésorier, bureau en lecture seule)
- Export du compte de résultat en PDF ou Excel
- Déplacement automatique des justificatifs lors d'un changement de classeur
- Règles de classement automatique selon le motif
