import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AxiosError, AxiosResponse } from 'axios';
import api from '../api/client';
import toast from 'react-hot-toast';
import { 
  Play, CheckCircle, 
  ShieldCheck, Link as LinkIcon, Square
} from 'lucide-react';

interface MediaMigrationConfig {
  spreadsheet_id: string;
  sheet_name: string;
  drive_folder_id: string;
}

interface MediaMigrationResult {
  success: number;
  failed: number;
}

interface MediaMigrationResponse {
  results: MediaMigrationResult;
}

interface ApiErrorBody {
  message?: string;
}

const MediaPage = () => {
  const [config, setConfig] = useState<MediaMigrationConfig>({
    spreadsheet_id: '',
    sheet_name: '',
    drive_folder_id: '',
  });
  const [result, setResult] = useState<MediaMigrationResult | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [isStopping, setIsStopping] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Status Google
    api.get('/google/status')
      .then(res => setGoogleConnected(res.data.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  const migrateMutation = useMutation<
    AxiosResponse<MediaMigrationResponse>,
    AxiosError<ApiErrorBody>,
    MediaMigrationConfig
  >({
    mutationFn: (data) => api.post<MediaMigrationResponse>('/media/migrate', data),
    onSuccess: (res) => {
      setResult(res.data.results);
      toast.success('Migration terminée avec succès');
    },
    onError: (err) => {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Erreur inconnue';
      
      if (status === 401) {
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span className="font-medium text-rose-400">Session Google expirée</span>
            <p className="text-[10px] text-gray-400">Veuillez vous reconnecter pour continuer la migration.</p>
            <button 
              onClick={() => {
                window.location.href = 'http://127.0.0.1:8000/api/google/login';
                toast.dismiss(t.id);
              }}
              className="btn-primary-linear !h-7 !px-2 !text-[10px] self-end"
            >
              Se reconnecter
            </button>
          </div>
        ), { duration: 6000 });
      } else {
        toast.error(msg);
      }
    }
  });

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [liveLogs]);

  useEffect(() => {
    let interval: number | undefined;
    if (migrateMutation.isPending) {
      interval = window.setInterval(async () => {
        try {
          const res = await api.get('/media/status');
          if (res.data.logs) setLiveLogs(res.data.logs);
        } catch (e) { console.error("Polling error", e); }
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [migrateMutation.isPending]);

  const extractGoogleId = (value: string) => {
    if (!value) return '';
    const match = value.match(/[-\w]{25,}/);
    return match ? match[0] : value.trim();
  };

  const handleMigrate = () => {
    // VÉRIFICATION PRÉ-VOL
    if (!navigator.onLine) {
        toast.error("Vérifiez votre connexion Internet.");
        return;
    }
    if (!googleConnected) {
        toast.error("Veuillez connecter votre compte Google dans la sidebar.");
        return;
    }
    if (!config.spreadsheet_id || !config.drive_folder_id) {
        toast.error("Veuillez remplir les champs obligatoires.");
        return;
    }

    setLiveLogs([]);
    setResult(null);
    setIsStopping(false);
    migrateMutation.mutate(config);
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await api.post('/media/stop');
      toast.success('Demande d\'arrêt envoyée');
    } catch (e) {
      toast.error('Erreur lors de l\'arrêt');
      setIsStopping(false);
    }
  };

  return (
    <div className="page-shell-narrow">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="page-kicker">Google Drive</p>
          <h1 className="page-title">Migration Média</h1>
          <p className="page-subtitle max-w-lg">
            Transfert automatisé des photos Kobo vers Google Drive avec mise à jour des liens Excel.
          </p>
        </div>
        <div className={`status-pill ${googleConnected ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
            <ShieldCheck size={10} />
            <span>{googleConnected ? 'Mode Direct Actif' : 'Vérifiez la connexion Google'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6 flex flex-col">
          <div className="surface-panel p-5 lg:p-6 space-y-6 flex-1 flex flex-col">
             <div className="space-y-6">
                <div className="space-y-2">
                    <label className="label-linear">Lien du Google Sheet Source</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                           <LinkIcon size={14} />
                        </div>
                        <input 
                            className="input-linear pl-8" 
                            placeholder="ID ou URL complète" 
                            value={config.spreadsheet_id} 
                            onChange={e => setConfig({...config, spreadsheet_id: extractGoogleId(e.target.value)})} 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="label-linear">Nom de l'onglet (Optionnel)</label>
                        <input 
                            className="input-linear" 
                            placeholder="ex: Photos" 
                            value={config.sheet_name} 
                            onChange={e => setConfig({...config, sheet_name: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="label-linear">Dossier Drive Cible</label>
                        <input 
                            className="input-linear" 
                            placeholder="Lien du dossier destination" 
                            value={config.drive_folder_id} 
                            onChange={e => setConfig({...config, drive_folder_id: extractGoogleId(e.target.value)})} 
                        />
                    </div>
                </div>
             </div>

             <div className="flex justify-end mt-2 gap-3">
                {migrateMutation.isPending && (
                  <button 
                    onClick={handleStop}
                    disabled={isStopping}
                    className="btn-secondary !bg-rose-500/10 !text-rose-500 !border-rose-500/20 hover:!bg-rose-500 hover:!text-white flex items-center gap-2 !h-10 !px-5 transition-all text-sm font-medium rounded-lg"
                  >
                    {isStopping ? 'Arrêt...' : <><Square size={12} fill="currentColor" /> Arrêter</>}
                  </button>
                )}
                <button 
                  onClick={handleMigrate}
                  disabled={migrateMutation.isPending}
                  className={`btn-primary-linear ${migrateMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {migrateMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      En cours...
                    </div>
                  ) : (
                    <><Play size={12} fill="white" /> Démarrer la Migration</>
                  )}
                </button>
             </div>
          </div>

          <div className="surface-panel-soft p-4">
             <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                <span className="font-semibold text-gray-600">Sécurité & Reprise :</span> L'application détecte automatiquement les photos déjà migrées pour éviter les doublons en cas de relance.
             </p>
          </div>
        </div>

        <div className="console-wrapper">
          <div className="console-header border-b-0">
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${migrateMutation.isPending ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-400'}`} />
                <span>Console de Sortie</span>
            </div>
          </div>
          
          {migrateMutation.isPending && (
            <div className="progress-bar-container">
               <div className="progress-bar-inner"></div>
            </div>
          )}
          <div className="border-b border-[rgba(255,255,255,0.06)]"></div>

          <div ref={consoleRef} className="console-content custom-scrollbar custom-scrollbar-dark">
            {liveLogs.length === 0 && !result && !migrateMutation.isPending && (
              <p className="text-xs text-white/20 text-center mt-8 font-sans">En attente de démarrage...</p>
            )}
            {migrateMutation.isPending && liveLogs.length === 0 && (
              <p className="text-xs text-white/30 text-center mt-8 animate-pulse font-sans">Initialisation...</p>
            )}
            
            {liveLogs.map((log, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-white/10 text-[9px] min-w-[45px] select-none">{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                <p className={`text-[11px] leading-relaxed break-words ${
                  log.startsWith('✅') ? 'text-emerald-400' : 
                  log.startsWith('❌') || log.startsWith('⚠️') ? 'text-rose-400' : 
                  'text-white/60'
                }`}>
                  {log}
                </p>
              </div>
            ))}

            {result && (
              <div className="mt-8 space-y-4 border-t border-white/[0.06] pt-6 pb-2">
                <div className="flex items-center gap-2 text-emerald-400 font-medium text-[11px]">
                  <CheckCircle size={12} /> OPÉRATION TERMINÉE
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] p-3 rounded-lg border border-white/[0.05] text-center">
                    <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Succès</p>
                    <p className="text-xl text-white font-semibold">{result.success}</p>
                  </div>
                  <div className="bg-white/[0.03] p-3 rounded-lg border border-white/[0.05] text-center">
                    <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Échecs</p>
                    <p className="text-xl text-rose-500 font-semibold">{result.failed}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPage;
