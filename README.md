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

## ▶️ Démarrage rapide (Windows)

> **C'est la méthode recommandée.** Aucune commande à taper.

### Prérequis (à installer une seule fois)

| Logiciel                  | Version minimale | Lien                                                                                 |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| **Python**                | 3.11+            | [python.org](https://www.python.org/downloads/) — ⚠️ cocher **"Add Python to PATH"** |
| **Node.js**               | 20+              | [nodejs.org](https://nodejs.org/)                                                    |
| **`client_secrets.json`** | —                | Fichier Google OAuth à placer dans `backend/`                                        |

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

- **Portabilité du venv** : L'environnement virtuel Python n'est **pas portable**. Si vous déplacez le dossier projet, supprimez `backend/venv/` et relancez `Lancer.bat` — il le recrée automatiquement.
- **Scopes OAuth** : L'application requiert `drive.file` et `spreadsheets`.
- **Environnement Dev** : En local, `OAUTHLIB_INSECURE_TRANSPORT` est activé pour autoriser le flux OAuth via HTTP.
- **Base de Données** : Utilise SQLite (`kobo_automation.db`) pour stocker localement les configurations de comptes et les logs.
