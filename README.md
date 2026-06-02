# 🚀 Kobo Automation Suite

Une solution complète pour automatiser l'extraction, la fusion et la migration de données KoboToolbox vers Google Drive et Google Sheets.

## ✨ Fonctionnalités Clés

### 1. 📂 Exportations Intelligentes par Site

- **Fusion Multi-Comptes** : Connectez plusieurs comptes Kobo pour croiser les données de différentes sources.
- **Déduplication Automatique** : Fusion intelligente basée sur l'identifiant unique `_uuid`.
- **Contrôle Granulaire** : Sélection dynamique des feuilles (sheets) et des colonnes à exporter.
- **Partitionnement par Site** : Division automatique des exports en fichiers Excel distincts basés sur une colonne pivot (ex: site, ville, fokontany).
- **Standardisation des Noms** : Ajout automatique de préfixes descriptifs (ex: AGR, Environnement) pour une meilleure organisation.
- **Intégration Drive** : Conversion automatique des fichiers Excel en Google Sheets directement dans le dossier Drive de votre choix.

### 2. 🖼️ Migration Média Automatisée

- **Détection Dynamique** : Analyse automatique des Google Sheets pour identifier les colonnes contenant des liens photos Kobo (`_URL`).
- **Transfert Direct** : Téléchargement sécurisé depuis Kobo et upload vers votre Drive personnel.
- **Lien Dynamique** : Remplacement automatique des URLs Kobo par les liens Drive dans votre feuille de calcul.
- **Suivi en Temps Réel** : Logs d'exécution détaillés pour suivre la progression du transfert photo par photo.

### 3. 🔐 Authentification OAuth2

- **Zéro Limite de Quota** : Utilisation de votre propre compte Google pour bypasser les limites des comptes de service partagés.
- **Sécurité Maximale** : Authentification via les protocoles standards Google OAuth2.

---

## 🛠️ Installation

### Prérequis

- **Python** 3.10+
- **Node.js** 18+
- Un fichier `client_secrets.json` (Google OAuth credentials) placé dans le dossier `backend/`.

### Configuration Backend

1. Naviguez dans le dossier backend :
   ```bash
   cd backend
   ```
2. Créez et activez un environnement virtuel :
   ```bash
   python -m venv venv
   # Sur Windows (PowerShell) :
   .\venv\Scripts\Activate.ps1
   # Sur Linux/macOS :
   source venv/bin/activate
   ```
3. Installez les dépendances :
   ```bash
   pip install -r requirements.txt
   ```
4. Lancez le serveur :
   ```bash
   uvicorn app.main:app --reload
   ```

### Configuration Frontend

1. Naviguez dans le dossier frontend :
   ```bash
   cd ../frontend
   ```
2. Installez les packages :
   ```bash
   npm install
   ```
3. Lancez l'application en mode développement :
   ```bash
   npm run dev
   ```

---

## 📖 Utilisation

1. **Gestion des Comptes** : Enregistrez vos instances Kobo (Nom, URL, API Key).
2. **Connexion Google** : Liez votre compte via le bouton Google Login dans la barre latérale.
3. **Flux d'Exportation** :
   - Sélectionnez vos comptes et le formulaire source.
   - Choisissez les colonnes et feuilles spécifiques.
   - Définissez la colonne pivot pour le partitionnement par site.
   - Indiquez l'ID du dossier Drive cible pour la conversion.
4. **Migration Média** :
   - Collez l'URL de votre Google Sheet.
   - L'outil scannera automatiquement les onglets et migre les médias trouvés.

---

## ⚠️ Notes Techniques

- **Scopes OAuth** : L'application requiert `drive.file` et `spreadsheets`.
- **Environnement Dev** : En local, `OAUTHLIB_INSECURE_TRANSPORT` est activé pour autoriser le flux OAuth via HTTP.
- **Base de Données** : Utilise SQLite (`kobo_automation.db`) pour stocker localement les configurations de comptes et les logs.
