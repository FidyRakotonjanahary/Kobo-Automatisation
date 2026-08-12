import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AxiosError, AxiosResponse } from 'axios';
import api from '../api/client';
import toast from 'react-hot-toast';
import {
  Play, CheckCircle,
  ShieldCheck, Link as LinkIcon, Square, Plus, Trash2,
  FileSpreadsheet, Sheet, Upload, Download
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type SourceMode = 'google_sheet' | 'excel_local';

interface SheetConfig {
  spreadsheet_id: string;
  sheet_name: string;
  drive_folder_id: string;
  sheet_folder_mapping?: Record<string, string>;
}

interface FailedItem {
  sheet: string;
  row: number;
  col: string;
  url: string;
  reason: string;
}

interface MediaMigrationResult {
  success: number;
  failed: number;
  failed_items?: FailedItem[];
}

interface MediaMigrationProgress {
  current: number;
  total: number;
  percent: number;
}

interface MediaMigrationResponse {
  results: MediaMigrationResult;
}

interface ApiErrorBody {
  message?: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'phaos_media_migration_config';

const MediaPage = () => {
  const getSavedConfig = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const saved = getSavedConfig();

  const [sourceMode, setSourceMode] = useState<SourceMode>(saved?.sourceMode || 'google_sheet');

  // Google Sheet state
  const [config, setConfig] = useState<SheetConfig>(saved?.config || {
    spreadsheet_id: '',
    sheet_name: '',
    drive_folder_id: '',
  });
  const [updateLinksSheet, setUpdateLinksSheet] = useState(saved?.updateLinksSheet ?? true);

  // Excel local state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelDriveFolderId, setExcelDriveFolderId] = useState(saved?.excelDriveFolderId || '');
  const [excelSheetName, setExcelSheetName] = useState(saved?.excelSheetName || '');
  const [updateLinks, setUpdateLinks] = useState(saved?.updateLinks ?? true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared state
  const [mappings, setMappings] = useState<{ sheet: string; folder: string }[]>(saved?.mappings || []);

  // Persistance dans localStorage
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sourceMode,
        config,
        excelDriveFolderId,
        excelSheetName,
        updateLinks,
        updateLinksSheet,
        mappings,
      })
    );
  }, [sourceMode, config, excelDriveFolderId, excelSheetName, updateLinks, updateLinksSheet, mappings]);
  const [result, setResult] = useState<MediaMigrationResult | null>(null);
  const [progress, setProgress] = useState<MediaMigrationProgress | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [isStopping, setIsStopping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/google/status')
      .then(res => setGoogleConnected(res.data.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  // ── Google Sheet mutation ──
  const migrateMutation = useMutation<
    AxiosResponse<MediaMigrationResponse>,
    AxiosError<ApiErrorBody>,
    SheetConfig & { update_links: boolean }
  >({
    mutationFn: (data) => api.post<MediaMigrationResponse>('/media/migrate', data),
    onSuccess: (res) => {
      setResult(res.data.results);
      toast.success(updateLinksSheet ? 'Migration terminée — liens mis à jour dans le Sheet !' : 'Photos uploadées sur Drive avec succès !');
    },
    onError: handleApiError,
  });

  // ── Excel local mutation ──
  const migrateExcelMutation = useMutation<void, AxiosError<ApiErrorBody>, FormData>({
    mutationFn: async (formData) => {
      const wantsUpdate = formData.get('update_links') === 'true';

      if (wantsUpdate) {
        // Mode mise à jour : réponse = fichier blob à télécharger
        const response = await api.post('/media/migrate-excel', formData, {
          responseType: 'blob',
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const contentDisposition = response.headers['content-disposition'] || '';
        const fnMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        const filename = fnMatch ? fnMatch[1] : 'migrated.xlsx';
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Mode upload seul : réponse = JSON stats
        const response = await api.post<MediaMigrationResponse>('/media/migrate-excel', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setResult(response.data.results);
      }
    },
    onSuccess: () => {
      if (updateLinks) {
        toast.success('Migration terminée — fichier Excel téléchargé !');
        // Récupérer les stats depuis le status
        api.get('/media/status').then(res => {
          if (res.data.last_stats) setResult(res.data.last_stats);
        });
      } else {
        toast.success('Photos uploadées sur Drive avec succès !');
      }
    },
    onError: handleApiError,
  });

  function handleApiError(err: AxiosError<ApiErrorBody>) {
    const status = err.response?.status;
    const msg = (err.response?.data as ApiErrorBody)?.message || 'Erreur inconnue';
    if (status === 401) {
      toast((t) => (
        <div className="flex flex-col gap-2">
          <span className="font-medium text-rose-400">Session Google expirée</span>
          <button
            onClick={() => {
              window.location.href = 'http://127.0.0.1:8000/api/google/login';
              toast.dismiss(t.id);
            }}
            className="btn-primary-linear !h-7 !px-2 !text-[10px]"
          >
            Se reconnecter
          </button>
        </div>
      ), { duration: 6000 });
    } else {
      toast.error(msg);
    }
  }

  const isRunning = migrateMutation.isPending || migrateExcelMutation.isPending;

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [liveLogs]);

  // Polling logs
  useEffect(() => {
    let interval: number | undefined;
    if (isRunning) {
      interval = window.setInterval(async () => {
        try {
          const res = await api.get('/media/status');
          if (res.data.logs) setLiveLogs(res.data.logs);
          if (res.data.progress) setProgress(res.data.progress);
        } catch (e) { console.error('Polling error', e); }
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRunning]);

  const extractGoogleId = (value: string) => {
    if (!value) return '';
    const match = value.match(/[-\w]{25,}/);
    return match ? match[0] : value.trim();
  };

  // ── Drag & Drop ──
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setExcelFile(f);
    } else {
      toast.error('Veuillez déposer un fichier Excel (.xlsx ou .xls)');
    }
  };

  // ── Lancer la migration ──
  const handleMigrate = () => {
    if (!navigator.onLine) { toast.error('Vérifiez votre connexion Internet.'); return; }
    if (!googleConnected) { toast.error('Veuillez connecter votre compte Google.'); return; }

    const mappingRecord: Record<string, string> = {};
    mappings.forEach(m => {
      if (m.sheet.trim() && m.folder.trim()) {
        mappingRecord[m.sheet.trim()] = extractGoogleId(m.folder);
      }
    });

    setLiveLogs([]);
    setResult(null);
    setProgress(null);
    setIsStopping(false);

    if (sourceMode === 'google_sheet') {
      if (!config.spreadsheet_id || !config.drive_folder_id) {
        toast.error('Veuillez remplir les champs obligatoires.');
        return;
      }
      migrateMutation.mutate({
        ...config,
        update_links: updateLinksSheet,
        sheet_folder_mapping: Object.keys(mappingRecord).length > 0 ? mappingRecord : undefined,
      });
    } else {
      if (!excelFile) { toast.error('Veuillez sélectionner un fichier Excel.'); return; }
      if (!excelDriveFolderId) { toast.error('Veuillez renseigner le dossier Drive de destination.'); return; }

      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('drive_folder_id', extractGoogleId(excelDriveFolderId));
      formData.append('sheet_name', excelSheetName);
      formData.append('sheet_folder_mapping', JSON.stringify(mappingRecord));
      formData.append('update_links', String(updateLinks));
      migrateExcelMutation.mutate(formData);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await api.post('/media/stop');
      toast.success("Demande d'arrêt envoyée");
    } catch {
      toast.error("Erreur lors de l'arrêt");
      setIsStopping(false);
    }
  };

  const addMapping = () => setMappings([...mappings, { sheet: '', folder: '' }]);
  const removeMapping = (i: number) => setMappings(mappings.filter((_, idx) => idx !== i));
  const updateMapping = (i: number, field: 'sheet' | 'folder', value: string) => {
    const n = [...mappings];
    n[i][field] = value;
    setMappings(n);
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="page-shell-narrow">
      {/* En-tête */}
      <div className="page-header">
        <div>
          <p className="page-kicker">Google Drive</p>
          <h1 className="page-title">Migration Média</h1>
          <p className="page-subtitle max-w-lg">
            Transfert automatisé des photos Kobo vers Google Drive avec remise en forme des liens.
          </p>
        </div>
        <div className={`status-pill ${googleConnected ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
          <ShieldCheck size={10} />
          <span>{googleConnected ? 'Mode Direct Actif' : 'Vérifiez la connexion Google'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6 flex flex-col">
          <div className="surface-panel p-5 lg:p-6 space-y-6 flex-1">

            {/* ── Sélecteur de mode source ── */}
            <div>
              <label className="label-linear mb-2 block">Source des données</label>
              <div className="grid grid-cols-2 gap-3">
                {/* Google Sheet */}
                <button
                  onClick={() => setSourceMode('google_sheet')}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    sourceMode === 'google_sheet'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${sourceMode === 'google_sheet' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Sheet size={16} />
                  </div>
                  <div>
                    <p className={`text-[12px] font-semibold ${sourceMode === 'google_sheet' ? 'text-indigo-700' : 'text-gray-700'}`}>
                      Google Sheet
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Lien mis à jour en direct</p>
                  </div>
                </button>

                {/* Excel local */}
                <button
                  onClick={() => setSourceMode('excel_local')}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    sourceMode === 'excel_local'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${sourceMode === 'excel_local' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <p className={`text-[12px] font-semibold ${sourceMode === 'excel_local' ? 'text-emerald-700' : 'text-gray-700'}`}>
                      Fichier Excel local
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Fichier modifié à télécharger</p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Formulaire Google Sheet ── */}
            {sourceMode === 'google_sheet' && (
              <div className="space-y-4">
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
                      onChange={e => setConfig({ ...config, spreadsheet_id: extractGoogleId(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-linear">Nom de l'onglet (Optionnel)</label>
                    <input
                      className="input-linear"
                      placeholder="Par défaut : tous"
                      value={config.sheet_name}
                      onChange={e => setConfig({ ...config, sheet_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-linear">Dossier Drive Principal</label>
                    <input
                      className="input-linear"
                      placeholder="Destination par défaut"
                      value={config.drive_folder_id}
                      onChange={e => setConfig({ ...config, drive_folder_id: extractGoogleId(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Bannière contextuelle Sheet */}
                <div className={`flex items-start gap-2 p-3 rounded-xl border transition-all ${
                  updateLinksSheet ? 'bg-indigo-50 border-indigo-100' : 'bg-sky-50 border-sky-100'
                }`}>
                  {updateLinksSheet
                    ? <LinkIcon size={14} className="text-indigo-600 mt-0.5 shrink-0" />
                    : <Upload size={14} className="text-sky-600 mt-0.5 shrink-0" />
                  }
                  <p className={`text-[11px] leading-relaxed ${
                    updateLinksSheet ? 'text-indigo-700' : 'text-sky-700'
                  }`}>
                    {updateLinksSheet
                      ? <>Les URLs Kobo dans le Sheet seront <strong>remplacées par des liens Drive</strong> en direct.</>  
                      : <>Les photos seront <strong>uploadées sur Drive</strong> mais le Google Sheet ne sera <strong>pas modifié</strong>.</>
                    }
                  </p>
                </div>

                {/* Toggle mise à jour des liens Sheet */}
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-700">Mettre à jour les liens dans le Sheet</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {updateLinksSheet ? 'Les URLs Kobo seront remplacées par des liens Drive' : 'Upload uniquement — Google Sheet non modifié'}
                    </p>
                  </div>
                  <button
                    onClick={() => setUpdateLinksSheet(!updateLinksSheet)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      updateLinksSheet ? 'bg-indigo-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      updateLinksSheet ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Formulaire Excel local ── */}
            {sourceMode === 'excel_local' && (
              <div className="space-y-4">
                {/* Zone de dépôt fichier */}
                <div className="space-y-2">
                  <label className="label-linear">Fichier Excel (.xlsx)</label>
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                      isDragging
                        ? 'border-emerald-400 bg-emerald-50'
                        : excelFile
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                    }`}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) setExcelFile(f);
                      }}
                    />
                    {excelFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <FileSpreadsheet size={20} className="text-emerald-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-[12px] font-semibold text-emerald-700">{excelFile.name}</p>
                          <p className="text-[10px] text-gray-400">{(excelFile.size / 1024).toFixed(1)} Ko — Cliquer pour changer</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-gray-100 rounded-xl">
                          <Upload size={20} className="text-gray-400" />
                        </div>
                        <p className="text-[12px] font-medium text-gray-500">Glisser-déposer ou cliquer pour sélectionner</p>
                        <p className="text-[10px] text-gray-400">.xlsx ou .xls uniquement</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-linear">Nom de l'onglet (Optionnel)</label>
                    <input
                      className="input-linear"
                      placeholder="Par défaut : tous"
                      value={excelSheetName}
                      onChange={e => setExcelSheetName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-linear">Dossier Drive Principal</label>
                    <input
                      className="input-linear"
                      placeholder="ID ou URL du dossier Drive"
                      value={excelDriveFolderId}
                      onChange={e => setExcelDriveFolderId(e.target.value)}
                    />
                  </div>
                </div>

                {/* Note résultat */}
                <div className={`flex items-start gap-2 p-3 rounded-xl border transition-all ${
                  updateLinks
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-sky-50 border-sky-100'
                }`}>
                  {updateLinks
                    ? <Download size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    : <Upload size={14} className="text-sky-600 mt-0.5 shrink-0" />
                  }
                  <p className={`text-[11px] leading-relaxed ${
                    updateLinks ? 'text-emerald-700' : 'text-sky-700'
                  }`}>
                    {updateLinks
                      ? <>Le fichier Excel avec les <strong>liens Drive</strong> sera <strong>téléchargé automatiquement</strong>.</>
                      : <>Les photos seront <strong>uploadées sur Drive</strong> mais le fichier Excel ne sera <strong>pas modifié</strong>. Aucun téléchargement.</>}
                  </p>
                </div>

                {/* Toggle mise à jour des liens */}
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-700">Mettre à jour les liens dans le fichier</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {updateLinks ? 'Les URLs Kobo seront remplacées par des liens Drive' : 'Upload uniquement — fichier Excel non modifié'}
                    </p>
                  </div>
                  <button
                    onClick={() => setUpdateLinks(!updateLinks)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      updateLinks ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      updateLinks ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Configuration par onglet (commun) ── */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Configuration par onglet (Optionnel)
                </label>
                <button
                  onClick={addMapping}
                  className="flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium bg-indigo-50 px-2 py-1 rounded"
                >
                  <Plus size={12} /> Ajouter un dossier spécifique
                </button>
              </div>

              <div className="space-y-2">
                {mappings.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="input-linear !h-9 text-[11px] flex-1"
                      placeholder="Nom de l'onglet (ex: reseau)"
                      value={m.sheet}
                      onChange={e => updateMapping(i, 'sheet', e.target.value)}
                    />
                    <input
                      className="input-linear !h-9 text-[11px] flex-[1.5]"
                      placeholder="ID du dossier Drive"
                      value={m.folder}
                      onChange={e => updateMapping(i, 'folder', extractGoogleId(e.target.value))}
                    />
                    <button
                      onClick={() => removeMapping(i)}
                      className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Boutons d'action ── */}
            <div className="flex justify-end mt-6 gap-3">
              {isRunning && (
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
                disabled={isRunning}
                className={`btn-primary-linear ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isRunning ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
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
              <span className="font-semibold text-gray-600">Note :</span>{' '}
              {sourceMode === 'google_sheet'
                ? updateLinksSheet
                  ? 'Si un onglet n\'est pas configuré ci-dessus, il utilisera le "Dossier Drive Principal".'
                  : 'Les photos sont archivées sur Google Drive. Le Google Sheet source reste intact.'
                : updateLinks
                ? 'Le fichier Excel original n\'est pas modifié. Une copie avec les liens Drive sera téléchargée.'
                : 'Les photos sont archivées sur Google Drive. Votre fichier Excel reste intact.'}
            </p>
          </div>
        </div>

        {/* ── Console ── */}
        <div className="console-wrapper">
          <div className="console-header flex flex-col gap-2 border-b-0 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="font-semibold text-white/90 text-xs">Console de Sortie</span>
              </div>
              {isRunning && progress && progress.total > 0 && (
                <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {progress.current} / {progress.total} ({progress.percent}%)
                </span>
              )}
            </div>

            {/* Barre de progression fluide */}
            {isRunning && progress && progress.total > 0 && (
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full transition-all duration-300 ${
                    sourceMode === 'google_sheet' ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            )}
          </div>

          <div ref={consoleRef} className="console-content custom-scrollbar custom-scrollbar-dark min-h-[400px]">
            {liveLogs.map((log, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-white/10 text-[9px] min-w-[45px] select-none">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium text-[11px]">
                    <CheckCircle size={12} /> OPÉRATION TERMINÉE
                  </div>
                  {result.failed_items && result.failed_items.length > 0 && (
                    <button
                      onClick={() => {
                        const headers = ['Onglet', 'Ligne', 'Colonne', 'URL Kobo', 'Raison_Echec'];
                        const csvRows = [
                          headers.join(';'),
                          ...result.failed_items!.map(item => [
                            `"${item.sheet}"`,
                            item.row,
                            `"${item.col}"`,
                            `"${item.url}"`,
                            `"${item.reason.replace(/"/g, '""')}"`
                          ].join(';'))
                        ];
                        const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.setAttribute('download', `erreurs_migration_${new Date().toISOString().slice(0,10)}.csv`);
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1.5 text-[10px] text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 px-2 py-1 rounded transition-colors"
                    >
                      <Download size={11} /> Rapport d'erreurs (CSV)
                    </button>
                  )}
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
