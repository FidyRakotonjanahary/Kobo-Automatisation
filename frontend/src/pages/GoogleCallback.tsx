import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const GoogleCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState('');

    const called = useRef(false);

    useEffect(() => {
        if (called.current) return;
        
        const code = searchParams.get('code');
        if (code) {
            called.current = true;
            api.post('/google/callback', { code })
                .then(() => {
                    setStatus('success');
                    setTimeout(() => window.location.href = '/', 2000);
                })
                .catch(err => {
                    setStatus('error');
                    setError(err.response?.data?.detail || 'Erreur lors de la validation du code.');
                });
        } else {
            setStatus('error');
            setError('Aucun code de validation reçu de Google.');
        }
    }, [searchParams, navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f7f8fb] p-6 text-center">
            <div className="surface-panel p-8 max-w-md w-full space-y-6">
                {status === 'loading' && (
                    <>
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                        <h1 className="page-title">Validation Google...</h1>
                        <p className="page-subtitle">Nous finalisons votre connexion sécurisée.</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                        <h1 className="page-title">Connexion Réussie !</h1>
                        <p className="page-subtitle">Vous allez être redirigé vers l'accueil...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                        <h1 className="page-title">Échec de Connexion</h1>
                        <p className="text-rose-600 bg-rose-50 p-4 rounded-lg text-sm italic border border-rose-100">{error}</p>
                        <button 
                            onClick={() => navigate('/')}
                            className="btn-primary-linear !h-10 w-full"
                        >
                            Retour à l'accueil
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default GoogleCallback;
