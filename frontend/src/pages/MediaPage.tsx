import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError, AxiosResponse } from 'axios';
import api from '../api/client';
import toast from 'react-hot-toast';
import {
  Play, CheckCircle,
  ShieldCheck, Link as LinkIcon, Square, Plus, Trash2,
  FileSpreadsheet, Sheet, Upload, Download, Clock, AlertTriangle,
  X, History, RefreshCw
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
  skipped_duplicates?: number;
  failed_items?: FailedItem[];
}

interface MediaMigrationProgress {
  current: number;
  total: number;
  percent: number;
  current_action?: string;
  success?: number;
  failed?: number;
}

interface MediaMigrationResponse {
  results: MediaMigrationResult;
}

interface ApiErrorBody {
  message?: string;
}

interface HistoryItem {
  id: number;
  source_type: string;
  source_name: string;
  sheet_name: string | null;
  drive_folder_id: string;
  total_items: number;
  success_count: number;
  failed_count: number;
  update_links: boolean;
  status: string;
  failed_items: FailedItem[];
  message: string | null;
  created_at: string;
}

// ─── Modal de confirmation ────────────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  sourceMode: SourceMode;
  spreadsheetId?: string;
  excelFileName?: string;
  driveFolderId?: string;
  updateLinks: boolean;
  totalMappings: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  open, sourceMode, spreadsheetId, excelFileName, driveFolderId,
  updateLinks, totalMappings, onConfirm, onCancel
}: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Panel */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-[15px]">Confirmer la migration</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Vérifiez les paramètres avant de lancer</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Résumé des paramètres */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-[12px]">
          <div className="flex justify-between items-start gap-2">
            <span className="text-gray-500 shrink-0">Source</span>
            <span className="font-semibold text-gray-700 text-right">
              {sourceMode === 'google_sheet' ? '📊 Google Sheet' : '📁 Fichier Excel local'}
            </span>
          </div>
          {sourceMode === 'google_sheet' && spreadsheetId && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-500 shrink-0">Sheet ID</span>
              <span className="font-mono text-indigo-600 text-[10px] text-right break-all">{spreadsheetId.slice(0, 40)}{spreadsheetId.length > 40 ? '…' : ''}</span>
            </div>
          )}
          {sourceMode === 'excel_local' && excelFileName && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-500 shrink-0">Fichier</span>
              <span className="font-semibold text-gray-700 text-right">{excelFileName}</span>
            </div>
          )}
          {driveFolderId && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-500 shrink-0">Drive (principal)</span>
              <span className="font-mono text-[10px] text-gray-600 text-right break-all">{driveFolderId.slice(0, 40)}{driveFolderId.length > 40 ? '…' : ''}</span>
            </div>
          )}
          {totalMappings > 0 && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-500 shrink-0">Mappings par onglet</span>
              <span className="font-semibold text-gray-700">{totalMappings} configuré(s)</span>
            </div>
          )}
          <div className="flex justify-between items-start gap-2">
            <span className="text-gray-500 shrink-0">Mode</span>
            <span className={`font-semibold ${updateLinks ? 'text-indigo-600' : 'text-sky-600'}`}>
              {updateLinks ? '✏️ Mise à jour des liens' : '⬆️ Upload seul (sans modification)'}
            </span>
          </div>
        </div>

        {/* Avertissement si mise à jour des liens */}
        {updateLinks && (
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              {sourceMode === 'google_sheet'
                ? 'Les URLs Kobo dans le Google Sheet seront <strong>remplacées de manière irréversible</strong> par des liens Google Drive.'
                : 'Un fichier Excel modifié sera téléchargé. Votre fichier original reste intact.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 h-10 border border-gray-200 rounded-xl text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[12px] font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            <Play size={12} fill="white" />
            Lancer la migration
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Historique ───────────────────────────────────────────────────────

function downloadErrorCsv(items: FailedItem[], label: string) {
  const headers = ['Onglet', 'Ligne', 'Colonne', 'URL Kobo', 'Raison_Echec'];
  const csvRows = [
    headers.join(';'),
    ...items.map(item => [
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
  a.setAttribute('download', `erreurs_${label}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function HistorySection() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: history = [], isLoading, refetch } = useQuery<HistoryItem[]>({
    queryKey: ['media-history'],
    queryFn: () => api.get('/media/history').then(r => r.data),
    staleTime: 30_000,
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/media/history'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-history'] });
      toast.success('Historique effacé');
      setConfirmClear(false);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'success': return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-semibold uppercase">Succès</span>;
      case 'partial': return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-semibold uppercase">Partiel</span>;
      case 'stopped': return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[9px] font-semibold uppercase">Stoppé</span>;
      default: return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[9px] font-semibold uppercase">{status}</span>;
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  if (!isLoading && history.length === 0) {
    return (
      <div className="surface-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History size={15} className="text-gray-400" />
            <h3 className="text-[12px] font-semibold text-gray-600 uppercase tracking-wider">Historique des migrations</h3>
          </div>
          <button onClick={() => refetch()} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Actualiser">
            <RefreshCw size={13} className="text-gray-400" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-2 py-6">
          <Clock size={28} className="text-gray-200" />
          <p className="text-[11px] text-gray-400">Aucune migration enregistrée pour l'instant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={15} className="text-gray-400" />
          <h3 className="text-[12px] font-semibold text-gray-600 uppercase tracking-wider">
            Historique des migrations
          </h3>
          {history.length > 0 && (
            <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{history.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Actualiser">
            <RefreshCw size={13} className="text-gray-400" />
          </button>
          {history.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-rose-600 font-medium">Confirmer ?</span>
                <button onClick={() => clearMutation.mutate()} className="text-[10px] text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded transition-colors">Oui</button>
                <button onClick={() => setConfirmClear(false)} className="text-[10px] text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 transition-colors">Non</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-600 transition-colors"
              >
                <Trash2 size={11} /> Tout effacer
              </button>
            )
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <svg className="animate-spin h-5 w-5 text-gray-300" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
          {history.map((item) => (
            <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* En-tête ligne historique */}
              <button
                className="w-full text-left px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center gap-3"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              >
                <div className="shrink-0">
                  {item.source_type === 'google_sheet'
                    ? <Sheet size={14} className="text-indigo-500" />
                    : <FileSpreadsheet size={14} className="text-emerald-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">
                    {item.source_name.length > 50 ? item.source_name.slice(0, 50) + '…' : item.source_name}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{formatDate(item.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(item.status)}
                  <span className="text-emerald-600 font-bold text-[11px]">✓{item.success_count}</span>
                  {item.failed_count > 0 && (
                    <span className="text-rose-500 font-bold text-[11px]">✗{item.failed_count}</span>
                  )}
                  <svg
                    className={`w-3 h-3 text-gray-400 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Détails expandés */}
              {expanded === item.id && (
                <div className="px-3 py-3 space-y-2 border-t border-gray-100 bg-white">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                    <div><span className="text-gray-400">Total traités :</span> <span className="font-medium text-gray-700">{item.total_items}</span></div>
                    <div><span className="text-gray-400">Succès :</span> <span className="font-semibold text-emerald-600">{item.success_count}</span></div>
                    <div><span className="text-gray-400">Échecs :</span> <span className={`font-semibold ${item.failed_count > 0 ? 'text-rose-500' : 'text-gray-500'}`}>{item.failed_count}</span></div>
                    <div><span className="text-gray-400">Mode :</span> <span className="font-medium text-gray-700">{item.update_links ? 'Mise à jour liens' : 'Upload seul'}</span></div>
                    {item.sheet_name && <div className="col-span-2"><span className="text-gray-400">Onglet :</span> <span className="font-medium text-gray-700">{item.sheet_name}</span></div>}
                    {item.message && <div className="col-span-2"><span className="text-gray-400">Note :</span> <span className="text-gray-500 italic">{item.message}</span></div>}
                  </div>
                  {item.failed_items && item.failed_items.length > 0 && (
                    <button
                      onClick={() => downloadErrorCsv(item.failed_items, `migration_${item.id}`)}
                      className="flex items-center gap-1.5 text-[10px] text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors w-full justify-center"
                    >
                      <Download size={11} />
                      Télécharger rapport d'erreurs CSV ({item.failed_items.length} échec{item.failed_items.length > 1 ? 's' : ''})
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const STORAGE_KEY = 'phaos_media_migration_config';

const MediaPage = () => {
  const queryClient = useQueryClient();

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

  // Modal de confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['media-history'] });
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
      queryClient.invalidateQueries({ queryKey: ['media-history'] });
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

  // Polling logs + progress temps réel
  useEffect(() => {
    let interval: number | undefined;
    if (isRunning) {
      interval = window.setInterval(async () => {
        try {
          const res = await api.get('/media/status');
          if (res.data.logs) setLiveLogs(res.data.logs);
          if (res.data.progress) setProgress(res.data.progress);
        } catch (e) { console.error('Polling error', e); }
      }, 800);
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

  // ── Construire les données de migration ──
  const buildMigrationPayload = useCallback(() => {
    const mappingRecord: Record<string, string> = {};
    mappings.forEach(m => {
      if (m.sheet.trim() && m.folder.trim()) {
        mappingRecord[m.sheet.trim()] = extractGoogleId(m.folder);
      }
    });
    return mappingRecord;
  }, [mappings]);

  // ── Ouvrir le modal de confirmation ──
  const handleMigrateClick = () => {
    if (!navigator.onLine) { toast.error('Vérifiez votre connexion Internet.'); return; }
    if (!googleConnected) { toast.error('Veuillez connecter votre compte Google.'); return; }

    if (sourceMode === 'google_sheet') {
      if (!config.spreadsheet_id || !config.drive_folder_id) {
        toast.error('Veuillez remplir les champs obligatoires.');
        return;
      }
    } else {
      if (!excelFile) { toast.error('Veuillez sélectionner un fichier Excel.'); return; }
      if (!excelDriveFolderId) { toast.error('Veuillez renseigner le dossier Drive de destination.'); return; }
    }

    setShowConfirmModal(true);
  };

  // ── Lancer effectivement la migration après confirmation ──
  const handleConfirmedMigrate = () => {
    setShowConfirmModal(false);
    const mappingRecord = buildMigrationPayload();

    setLiveLogs([]);
    setResult(null);
    setProgress(null);
    setIsStopping(false);

    if (sourceMode === 'google_sheet') {
      migrateMutation.mutate({
        ...config,
        update_links: updateLinksSheet,
        sheet_folder_mapping: Object.keys(mappingRecord).length > 0 ? mappingRecord : undefined,
      });
    } else {
      const formData = new FormData();
      formData.append('file', excelFile!);
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
      {/* Modal de confirmation */}
      <ConfirmModal
        open={showConfirmModal}
        sourceMode={sourceMode}
        spreadsheetId={config.spreadsheet_id}
        excelFileName={excelFile?.name}
        driveFolderId={sourceMode === 'google_sheet' ? config.drive_folder_id : excelDriveFolderId}
        updateLinks={sourceMode === 'google_sheet' ? updateLinksSheet : updateLinks}
        totalMappings={mappings.filter(m => m.sheet.trim() && m.folder.trim()).length}
        onConfirm={handleConfirmedMigrate}
        onCancel={() => setShowConfirmModal(false)}
      />

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
                onClick={handleMigrateClick}
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

          {/* ── Section Historique ── */}
          <HistorySection />
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

            {/* Action en cours */}
            {isRunning && progress?.current_action && (
              <p className="text-[9px] text-white/40 font-mono truncate">{progress.current_action}</p>
            )}

            {/* Compteurs succès/échecs live */}
            {isRunning && progress && progress.total > 0 && (
              <div className="flex gap-3">
                <span className="text-[9px] text-emerald-400 font-mono">✓ {progress.success ?? 0} succès</span>
                <span className="text-[9px] text-rose-400 font-mono">✗ {progress.failed ?? 0} échec{(progress.failed ?? 0) > 1 ? 's' : ''}</span>
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
                  log.startsWith('♻️') ? 'text-sky-400' :
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
                      onClick={() => downloadErrorCsv(result.failed_items!, 'migration')}
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
                {(result.skipped_duplicates ?? 0) > 0 && (
                  <p className="text-[10px] text-sky-400 font-mono text-center">♻️ {result.skipped_duplicates} photo(s) dédupliquée(s)</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPage;
