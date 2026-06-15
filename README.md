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

## 🔑 Étape 1 — Créer votre fichier `client_secrets.json`

> Cette étape est **obligatoire** avant le premier démarrage. Elle est **gratuite** et prend environ 5 minutes.

L'application utilise l'API Google (Drive + Sheets). Vous devez créer vos propres identifiants OAuth2 sur Google Cloud Console.

### Guide pas-à-pas

**1. Créer un projet Google Cloud**

- Allez sur [console.cloud.google.com](https://console.cloud.google.com/)
- Cliquez sur **"Sélectionner un projet"** → **"Nouveau projet"**
- Donnez un nom (ex: `kobo-automation`) et cliquez **"Créer"**

**2. Activer les APIs nécessaires**

- Dans le menu gauche : **"APIs et services"** → **"Bibliothèque"**
- Recherchez et activez :
  - ✅ **Google Drive API**
  - ✅ **Google Sheets API**
  - ✅ **Google+ API** (ou "People API")

**3. Créer les identifiants OAuth2**

- **"APIs et services"** → **"Identifiants"** → **"Créer des identifiants"** → **"ID client OAuth"**
- **Type d'application** : `Application Web`
- **Nom** : `Kobo Automation` (ou ce que vous voulez)
- **URI de redirection autorisés** → Ajouter : `http://localhost:3001/google-callback`
- Cliquez **"Créer"**

**4. Télécharger et renommer le fichier**

- Cliquez sur **⬇️ Télécharger le fichier JSON**
- Le fichier téléchargé s'appelle quelque chose comme `client_secret_XXXX.apps.googleusercontent.com.json`
- ⚠️ **Renommez-le exactement en : `client_secrets.json`** (avec un **s** à la fin)
- Placez-le dans le dossier **`backend/`** de ce projet

**5. Configurer l'écran de consentement** _(si demandé)_

- **"APIs et services"** → **"Écran de consentement OAuth"**
- Type : `Externe` → Remplissez le nom de l'application
- Ajoutez votre email dans **"Utilisateurs test"**

---

## ▶️ Étape 2 — Démarrer l'application (Windows)

### Prérequis logiciels

| Logiciel    | Version minimale | Lien                                                                                 |
| ----------- | ---------------- | ------------------------------------------------------------------------------------ |
| **Python**  | 3.11+            | [python.org](https://www.python.org/downloads/) — ⚠️ cocher **"Add Python to PATH"** |
| **Node.js** | 20+              | [nodejs.org](https://nodejs.org/)                                                    |

### Lancement

1. **Double-cliquer sur `Lancer.bat`** dans le dossier du projet.
2. Le script vérifie automatiquement les prérequis, installe les dépendances si nécessaire, démarre les serveurs et **ouvre le navigateur** sur `http://localhost:3001`.

> 💡 À la **première utilisation**, l'installation des dépendances peut prendre 1 à 2 minutes. Les fois suivantes, le démarrage est immédiat.

### Arrêt

- **Double-cliquer sur `Arreter.bat`** pour fermer proprement les serveurs backend et frontend.

---

## 🛠️ Installation manuelle (avancé)

### Backend

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

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Puis ouvrir : **http://localhost:3001**

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

- **`client_secrets.json`** : Ce fichier n'est **pas** inclus dans le dépôt (`.gitignore`). Chaque utilisateur crée le sien via Google Cloud Console (voir Étape 1).
- **Portabilité du venv** : L'environnement virtuel Python n'est **pas portable**. Si vous déplacez le dossier projet, supprimez `backend/venv/` et relancez `Lancer.bat` — il le recrée automatiquement.
- **Scopes OAuth** : L'application requiert `drive`, `spreadsheets`, et `userinfo.email`.
- **Environnement Dev** : En local, `OAUTHLIB_INSECURE_TRANSPORT` est activé pour autoriser le flux OAuth via HTTP.
- **Base de Données** : Utilise SQLite (`kobo_automation.db`) pour stocker localement les configurations de comptes et les logs.
