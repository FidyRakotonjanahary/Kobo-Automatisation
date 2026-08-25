import axios from 'axios';
import toast from 'react-hot-toast';

/**
 * Normalise l'URL de base pour toujours inclure le préfixe /api
 * et éviter les erreurs 404 si la variable VITE_API_BASE_URL
 * est fournie sans /api ou avec des slashes superflus.
 */
export const getApiBaseUrl = (): string => {
  const raw = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').trim().replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
};

// API Client - Configuré avec gestion globale des erreurs
const api = axios.create({
  baseURL: getApiBaseUrl(),
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
      toast.error("Connexion Internet indisponible ou serveur hors-ligne.", { id: 'net-err' });
      return Promise.reject(error);
    }

    const { status } = error.response;

    // Gestion spécifique par status si non traitée par le backend
    if (status === 401) {
      console.warn("Session expirée (401)");
    } else if (status === 429) {
      toast.error("Trop de requêtes. Veuillez patienter un instant.", { id: 'rate-err' });
    } else if (status === 503) {
      toast.error("Le service Kobo ou Google est indisponible (Maintenance).", { id: 'maint-err' });
    }

    return Promise.reject(error);
  }
);

export default api;
