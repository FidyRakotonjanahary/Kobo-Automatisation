import axios from 'axios';
import toast from 'react-hot-toast';

// API Client - Configuré avec gestion globale des erreurs [RELOAD_HMR]
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api', // Ajustez selon votre environnement
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour la gestion globale des erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Erreur réseau (Backend hors-ligne ou pas d'Internet)
      toast.error("Connexion Internet indisponible ou serveur hors-ligne.");
      return Promise.reject(error);
    }

    const { status } = error.response;

    // Gestion spécifique par status si non traitée par le backend
    if (status === 401) {
      // Toast spécial avec bouton reconnexion géré dans les composants
      console.warn("Session expirée (401)");
    } else if (status === 429) {
      toast.error("Trop de requêtes. Veuillez patienter un instant.");
    } else if (status === 503) {
      toast.error("Le service Kobo ou Google est indisponible (Maintenance).");
    }

    return Promise.reject(error);
  }
);

export default api;
