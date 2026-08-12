# 🚀 Kobo Automation Suite

Une solution complète et automatisée pour l'extraction, le partitionnement par site, la fusion multi-comptes et la migration de données KoboToolbox vers Google Drive et Google Sheets.

---

## ✨ Fonctionnalités Clés

### 1. 📂 Exportations Intelligentes par Site

- **Fusion Multi-Comptes** : Connectez plusieurs comptes Kobo pour croiser et regrouper les données issues de différentes sources.
- **Déduplication et Filtrage Parent-Enfant** : Jointure et filtrage stricts entre onglets principaux et sous-onglets (_repeat groups_) grâce à l'identifiant unique `_uuid` et aux paires `_index` / `_parent_index`.
- **Détection Robuste des Onglets** : Identification automatique de l'onglet racine par analyse de contenu (`start`, `_uuid`, `deviceid`), garantissant qu'aucun renommage ou troncature de nom par Kobo ne perturbe l'exportation.
- **Partitionnement & Regroupement par Site** : Division automatique des données en fichiers distincts basés sur une colonne pivot (ex: commune, site, fokontany). Regroupement automatique des sous-sites par leur racine commune (ex: `ANKAVANDRA_NORD` et `ANKAVANDRA_SUD` dans `ANKAVANDRA`).
- **Formats CSV & Excel (XLSX)** :
  - **Excel (XLSX)** : Conservation de l'arborescence multi-onglets des formulaires Kobo.
  - **CSV** : Exportation optimisée avec séparateur point-virgule (`;`) et encodage **UTF-8 avec BOM** pour une compatibilité parfaite avec Excel.
- **Dossier d'Export Dédié (`Exports_Kobo/`)** : Les fichiers sont générés localement à la racine du projet dans `Exports_Kobo/`, isolés du backend pour éviter les redémarrages intempestifs du serveur.
- **Contrôle & Annulation en Temps Réel** : Possibilité d'interrompre un traitement long à tout moment via le bouton **ARRÊTER**.
- **Ouverture Directe** : Consultation des résultats depuis la console d'export avec bouton **Ouvrir le dossier** et clic direct sur chaque fichier généré pour l'ouvrir dans Excel.
- **Intégration Google Drive** : Upload automatique des fichiers exportés vers le dossier Google Drive spécifié avec conversion automatique en Google Sheets.

### 2. 🖼️ Migration Média Automatisée

- **Détection Dynamique** : Analyse des Google Sheets pour identifier les colonnes contenant des liens de médias Kobo (`_URL`).
- **Transfert Direct & Sécurisé** : Téléchargement des médias depuis Kobo et téléversement vers votre Google Drive.
- **Mise à Jour des Liens** : Remplacement automatique des URLs Kobo temporaires par les liens d'accès Google Drive définitifs dans la feuille de calcul.
- **Suivi en Temps Réel** : Progression visible photo par photo dans la console d'exécution.

### 3. 🔐 Authentification OAuth2

- **Zéro Limite de Quota** : Utilisation de votre propre projet Google Cloud OAuth2.
- **Sécurité Maximale** : Authentification fluide et sécurisée via les protocoles standards Google OAuth2.

---

## 🔑 Étape 1 — Créer votre fichier `client_secrets.json`

> Cette étape est **obligatoire** avant le premier démarrage. Elle est gratuite et prend environ 5 minutes.

L'application utilise l'API Google (Drive + Sheets). Vous devez créer vos propres identifiants OAuth2 sur Google Cloud Console.

### Guide pas-à-pas

1. **Créer un projet Google Cloud**
   - Rendez-vous sur [console.cloud.google.com](https://console.cloud.google.com/)
   - Cliquez sur **"Sélectionner un projet"** → **"Nouveau projet"**
   - Saisissez un nom (ex: `kobo-automation`) et cliquez sur **"Créer"**

2. **Activer les APIs nécessaires**
   - Dans le menu de gauche : **"APIs et services"** → **"Bibliothèque"**
   - Recherchez et activez :
     - ✅ **Google Drive API**
     - ✅ **Google Sheets API**
     - ✅ **Google+ API** (ou **People API**)

3. **Créer les identifiants OAuth2**
   - **"APIs et services"** → **"Identifiants"** → **"Créer des identifiants"** → **"ID client OAuth"**
   - **Type d'application** : `Application Web`
   - **Nom** : `Kobo Automation`
   - **URI de redirection autorisés** → Ajouter : `http://localhost:3001/google-callback`
   - Cliquez sur **"Créer"**

4. **Télécharger et placer le fichier**
   - Cliquez sur **⬇️ Télécharger le fichier JSON**
   - Renommez le fichier téléchargé exactement en : **`client_secrets.json`** (avec un **s** à la fin)
   - Placez ce fichier dans le dossier **`backend/`** de ce projet

5. **Configurer l'écran de consentement** _(si nécessaire)_
   - **"APIs et services"** → **"Écran de consentement OAuth"**
   - Type : `Externe` → Remplissez le nom et votre e-mail de contact
   - Ajoutez votre adresse e-mail dans la section **"Utilisateurs test"**

---

## ▶️ Étape 2 — Démarrer l'application (Windows)

### Prérequis logiciels

| Logiciel    | Version minimale | Lien de téléchargement                                                             |
| :---------- | :--------------- | :--------------------------------------------------------------------------------- |
| **Python**  | 3.11+            | [python.org](https://www.python.org/downloads/) — ⚠️ _Cocher "Add Python to PATH"_ |
| **Node.js** | 20+              | [nodejs.org](https://nodejs.org/)                                                  |

### Lancement Automatique

1. **Double-cliquez sur `Lancer.bat`** à la racine du projet.
2. Le script vérifie les prérequis, prépare l'environnement virtuel Python, installe les dépendances requises, lance le backend FastAPI et le frontend Vite, puis **ouvre votre navigateur** sur `http://localhost:3001`.

> 💡 _À la première exécution, l'installation des dépendances peut prendre 1 à 2 minutes. Les démarrages ultérieurs sont quasi-instantanés._

### Arrêt

- **Double-cliquez sur `Arreter.bat`** à la racine du projet pour fermer proprement les serveurs backend et frontend.

---

## 🛠️ Installation et Lancement Manuels (Avancé)

### Backend (FastAPI)

```bash
cd backend
python -m venv venv

# Sur Windows (PowerShell) :
.\venv\Scripts\Activate.ps1
# Sur Linux/macOS :
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Accès à l'application : **http://localhost:3001**

---

## 📖 Guide d'Utilisation

1. **Gestion des Comptes Kobo** :
   - Enregistrez vos instances Kobo (Nom du compte, URL du serveur, Jeton API / API Key).
2. **Connexion Google** :
   - Authentifiez votre compte Google via le bouton de connexion dans le menu latéral.
3. **Flux d'Exportation par Site** :
   - Sélectionnez un ou plusieurs comptes et choisissez le formulaire source.
   - Choisissez les onglets à exporter (mode XLSX multi-onglets ou mode CSV onglet ciblé).
   - Sélectionnez la colonne pivot pour le partitionnement par site (ex: `commune`).
   - _(Optionnel)_ Renseignez l'ID du dossier Google Drive pour une conversion automatique.
   - Cliquez sur **Lancer l'Export**.
   - Dans la console de sortie, suivez l'avancement, utilisez **Ouvrir le dossier** ou cliquez sur un fichier avec l'icône **FileSpreadsheet** pour l'ouvrir directement dans Excel.
4. **Migration Média** :
   - Indiquez l'URL de la Google Sheet contenant les soumissions Kobo.
   - Lancez la migration pour transférer les photos vers Google Drive et mettre à jour la feuille.

---

## ⚠️ Notes Techniques & Bonnes Pratiques

- **Dossier des Exports (`Exports_Kobo/`)** : Situé à la racine du projet et ignoré par Git (`.gitignore`). Garantit que le rechargement du backend ne s'active pas lors des générations de fichiers.
- **Fichier `client_secrets.json`** : Ne doit pas être versionné (`.gitignore`). Chaque utilisateur doit créer le sien via Google Cloud Console.
- **Portabilité du venv** : L'environnement virtuel Python est local. Si vous déplacez le projet, supprimez le dossier `venv/` et réexécutez `Lancer.bat`.
- **Scopes OAuth2 Google** : Nécessite les autorisations `drive`, `spreadsheets` et `userinfo.email`.
- **Base de Données** : Base SQLite locale (`kobo_automation.db`) pour la persistance des comptes et l'historique d'exécution.
