# Kobo Automation Suite - Backend

Fondation minimale pour l'automatisation KoboToolbox.

## 🚀 Installation rapide (PowerShell)

1. **Venv et dépendances**

   ```powershell
   cd "backend"
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Lancement**

   ```powershell
   uvicorn app.main:app --reload
   ```

3. **Vérification**
   - Accueil : http://127.0.0.1:8000/
   - Santé : http://127.0.0.1:8000/api/health
   - Docs : http://127.0.0.1:8000/docs

## Migrations Alembic

Depuis le dossier `backend/`, creer une migration apres modification des modeles :

```powershell
.\venv\Scripts\alembic revision --autogenerate -m "description"
```

Appliquer les migrations :

```powershell
.\venv\Scripts\alembic upgrade head
```
