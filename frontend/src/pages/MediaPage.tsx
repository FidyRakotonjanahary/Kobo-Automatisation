import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError, AxiosResponse } from 'axios';
import api from '../api/client';
import toast from 'react-hot-toast';
import {
  Play,
  CheckCircle2,
  ShieldCheck,
  Link as LinkIcon,
  Square,
  Plus,
  Trash2,
  FileSpreadsheet,
  Sheet,
  Upload,
  Download,
  Clock,
  AlertTriangle,
  X,
  History,
  RefreshCw,
  FolderDown,
  Sparkles,
  Layers,
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

// ─── Utilitaire de téléchargement CSV des erreurs ─────────────────────────────

function downloadErrorCsv(items: FailedItem[], label: string) {
  const headers = ['Onglet', 'Ligne', 'Colonne', 'URL Kobo', 'Raison_Echec'];
  const csvRows = [
    headers.join(';'),
    ...items.map((item) =>
      [
        `"${item.sheet}"`,
        item.row,
        `"${item.col}"`,
        `"${item.url}"`,
        `"${item.reason.replace(/"/g, '""')}"`,
      ].join(';')
    ),
  ];
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute(
    'download',
    `erreurs_${label}_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Modal de Confirmation ───────────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  sourceMode: SourceMode;
  spreadsheetId?: string;
  sheetName?: string;
  excelFile?: File | null;
  driveFolderId: string;
  mappings: { sheet: string; folder: string }[];
  updateLinks: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  open,
  sourceMode,
  spreadsheetId,
  sheetName,
  excelFile,
  driveFolderId,
  mappings,
  updateLinks,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const validMappings = mappings.filter(
    (m) => m.sheet.trim() && m.folder.trim()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay sombre */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onCancel}
      />

      {/* Boîte de dialogue */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête du modal */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
              <Sparkles size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-[15px]">
                Confirmer la migration des médias
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Vérifiez la configuration avant le démarrage du transfert
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Résumé des paramètres */}
        <div className="bg-gray-50/80 rounded-xl p-4 space-y-2.5 text-[12px] border border-gray-100">
          {/* Source */}
          <div className="flex justify-between items-center gap-2 pb-2 border-b border-gray-200/60">
            <span className="text-gray-500 font-medium">Source de données</span>
            <span className="font-bold text-gray-800 flex items-center gap-1.5">
              {sourceMode === 'google_sheet' ? (
                <>
                  <Sheet size={13} className="text-indigo-600" />
                  Google Sheet
                </>
              ) : (
                <>
                  <FileSpreadsheet size={13} className="text-emerald-600" />
                  Fichier Excel local
                </>
              )}
            </span>
          </div>

          {/* Fichier ou ID */}
          {sourceMode === 'google_sheet' && spreadsheetId && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-500 shrink-0">Identifiant Sheet</span>
              <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50/60 px-2 py-0.5 rounded border border-indigo-100 break-all text-right max-w-[280px]">
                {spreadsheetId}
              </span>
            </div>
          )}
          {sourceMode === 'excel_local' && excelFile && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500 shrink-0">Fichier</span>
              <span className="font-semibold text-gray-800 text-right truncate max-w-[280px]">
                {excelFile.name} ({(excelFile.size / 1024).toFixed(1)} Ko)
              </span>
            </div>
          )}

          {/* Onglet ciblé */}
          <div className="flex justify-between items-center gap-2">
            <span className="text-gray-500">Onglet ciblé</span>
            <span className="font-semibold text-gray-800">
              {sheetName && sheetName.trim()
                ? `« ${sheetName.trim()} »`
                : 'Tous les onglets'}
            </span>
          </div>

          {/* Dossier Drive Principal */}
          <div className="flex justify-between items-start gap-2">
            <span className="text-gray-500 shrink-0">Dossier Drive principal</span>
            <span className="font-mono text-[11px] text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200 break-all text-right max-w-[280px]">
              {driveFolderId}
            </span>
          </div>

          {/* Mappings personnalisés */}
          {validMappings.length > 0 && (
            <div className="pt-2 border-t border-gray-200/60 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] font-bold text-gray-600 uppercase tracking-tight">
                <Layers size={11} className="text-indigo-500" />
                <span>Dossiers spécifiques par onglet ({validMappings.length})</span>
              </div>
              <div className="space-y-1 pl-2">
                {validMappings.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] text-gray-600 bg-white p-1.5 rounded border border-gray-100"
                  >
                    <span className="font-medium text-gray-800">{m.sheet}</span>
                    <span className="text-gray-400 font-mono text-[10px] truncate max-w-[180px]">
                      ➔ {m.folder}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode de traitement */}
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-200/60">
            <span className="text-gray-500">Mode de mise à jour</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                updateLinks
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-sky-50 text-sky-700 border border-sky-200'
              }`}
            >
              {updateLinks ? 'Mise à jour des liens' : 'Upload seul'}
            </span>
          </div>
        </div>

        {/* Avertissement contextuel selon le mode */}
        {updateLinks ? (
          <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-xl">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {sourceMode === 'google_sheet' ? (
                <>
                  <strong>Attention :</strong> Les URLs Kobo dans le Google
                  Sheet seront <strong>remplacées en direct</strong> par les
                  nouveaux liens Google Drive.
                </>
              ) : (
                <>
                  <strong>Information :</strong> Une copie modifiée contenant
                  les nouveaux liens Google Drive sera{' '}
                  <strong>téléchargée automatiquement</strong> à la fin.
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3.5 bg-sky-50/90 border border-sky-200/80 rounded-xl">
            <ShieldCheck size={15} className="text-sky-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-sky-800 leading-relaxed">
              <strong>Upload seul :</strong> Les photos seront transférées sur
              Google Drive. Votre source (Sheet ou fichier Excel) ne sera{' '}
              <strong>pas modifiée</strong>.
            </p>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-700 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-10 btn-primary-linear rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Play size={12} fill="currentColor" />
            <span>Confirmer &amp; Démarrer</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Historique (Persistant en Base de Données) ─────────────────────────

function HistorySection() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const {
    data: history = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<HistoryItem[]>({
    queryKey: ['media-history'],
    queryFn: () => api.get('/media/history').then((r) => r.data),
    staleTime: 30_000,
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/media/history'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-history'] });
      toast.success('Historique effacé avec succès');
      setConfirmClear(false);
    },
    onError: () => toast.error("Erreur lors de la suppression de l'historique"),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9px] font-bold uppercase">
            Succès
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-bold uppercase">
            Partiel
          </span>
        );
      case 'stopped':
        return (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-[9px] font-bold uppercase">
            Stoppé
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[9px] font-bold uppercase">
            {status}
          </span>
        );
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="surface-panel overflow-hidden flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* En-tête de l'historique */}
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <History size={14} className="text-gray-500" />
          <span className="text-[13px] font-bold text-gray-900">
            Historique persistant des migrations
          </span>
          {isFetching && (
            <RefreshCw size={11} className="text-indigo-500 animate-spin" />
          )}
          {history.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {history.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
            title="Actualiser l'historique"
          >
            <RefreshCw size={12} />
          </button>
          {history.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5 bg-rose-50 p-1 rounded-md border border-rose-100">
                <span className="text-[10px] text-rose-700 font-medium">
                  Confirmer ?
                </span>
                <button
                  type="button"
                  onClick={() => clearMutation.mutate()}
                  className="text-[10px] text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded font-medium transition-colors"
                >
                  Oui
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="text-[10px] text-gray-600 hover:text-gray-800 px-1.5 py-0.5 rounded border border-gray-200 bg-white transition-colors"
                >
                  Non
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Effacer tout l'historique de la base de données"
              >
                <Trash2 size={11} />
                <span>Effacer</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Contenu de l'historique */}
      <div className="p-4 bg-slate-50/30">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <RefreshCw size={18} className="text-gray-300 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-1.5">
            <Clock size={24} className="text-gray-300" />
            <p className="text-[12px] font-semibold text-gray-600">
              Aucune migration enregistrée
            </p>
            <p className="text-[10px] text-gray-400 max-w-[260px]">
              Vos futures opérations de transfert apparaîtront ici et seront
              conservées de manière persistante.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200/90 rounded-xl overflow-hidden shadow-2xs hover:border-indigo-200 transition-all"
              >
                {/* Ligne principale */}
                <button
                  type="button"
                  className="w-full text-left px-3.5 py-2.5 bg-gray-50/50 hover:bg-gray-50 flex items-center justify-between gap-3 transition-colors"
                  onClick={() =>
                    setExpanded(expanded === item.id ? null : item.id)
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 p-1.5 rounded-lg bg-gray-100 text-gray-600">
                      {item.source_type === 'google_sheet' ? (
                        <Sheet size={13} className="text-indigo-600" />
                      ) : (
                        <FileSpreadsheet
                          size={13}
                          className="text-emerald-600"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-900 truncate max-w-[260px]">
                        {item.source_name}
                      </p>
                      <p className="text-[9px] text-gray-400 font-mono">
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(item.status)}
                    <span className="text-[11px] font-bold text-emerald-600 font-mono">
                      ✓{item.success_count}
                    </span>
                    {item.failed_count > 0 && (
                      <span className="text-[11px] font-bold text-rose-500 font-mono">
                        ✗{item.failed_count}
                      </span>
                    )}
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                        expanded === item.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Détails expandés */}
                {expanded === item.id && (
                  <div className="p-3.5 border-t border-gray-100 bg-white space-y-2.5 text-[11px]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <span className="text-[9px] text-gray-400 uppercase font-bold block">
                          Total
                        </span>
                        <span className="font-semibold text-gray-800">
                          {item.total_items} photos
                        </span>
                      </div>
                      <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
                        <span className="text-[9px] text-emerald-600 uppercase font-bold block">
                          Succès
                        </span>
                        <span className="font-bold text-emerald-700">
                          {item.success_count}
                        </span>
                      </div>
                      <div className="p-2 bg-rose-50/60 rounded-lg border border-rose-100">
                        <span className="text-[9px] text-rose-600 uppercase font-bold block">
                          Échecs
                        </span>
                        <span className="font-bold text-rose-700">
                          {item.failed_count}
                        </span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <span className="text-[9px] text-gray-400 uppercase font-bold block">
                          Mode
                        </span>
                        <span className="font-semibold text-gray-800">
                          {item.update_links ? 'Liens MAJ' : 'Upload seul'}
                        </span>
                      </div>
                    </div>

                    {item.sheet_name && (
                      <p className="text-[10px] text-gray-500">
                        <strong>Onglet ciblé :</strong> {item.sheet_name}
                      </p>
                    )}
                    {item.message && (
                      <p className="text-[10px] text-sky-700 bg-sky-50 px-2 py-1 rounded border border-sky-100">
                        ℹ️ {item.message}
                      </p>
                    )}

                    {/* Bouton téléchargement CSV si erreurs */}
                    {item.failed_items && item.failed_items.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadErrorCsv(
                            item.failed_items,
                            `migration_${item.id}`
                          )
                        }
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-semibold transition-colors"
                      >
                        <Download size={11} />
                        <span>
                          Télécharger le rapport d'erreurs (
                          {item.failed_items.length} échec
                          {item.failed_items.length > 1 ? 's' : ''})
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Console de Sortie & Résultats (Thème Clair Harmonisé) ─────────────────────

interface MediaConsoleProps {
  consoleRef: React.RefObject<HTMLDivElement>;
  isRunning: boolean;
  isStopping: boolean;
  progress: MediaMigrationProgress | null;
  liveLogs: string[];
  result: MediaMigrationResult | null;
  sourceMode: SourceMode;
  spreadsheetId: string;
  excelFile: File | null;
  driveFolderId: string;
  onStop: () => void;
  onClear: () => void;
}

function MediaConsole({
  consoleRef,
  isRunning,
  isStopping,
  progress,
  liveLogs,
  result,
  sourceMode,
  spreadsheetId,
  excelFile,
  driveFolderId,
  onStop,
  onClear,
}: MediaConsoleProps) {
  const hasLogs = liveLogs.length > 0;
  const hasResult = result !== null;

  return (
    <div className="surface-panel overflow-hidden flex flex-col min-h-[600px] lg:h-[750px] bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* ── En-tête : Résultats de la migration ── */}
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isRunning
                ? 'bg-indigo-600 animate-ping'
                : hasResult || hasLogs
                ? 'bg-emerald-500'
                : 'bg-gray-300'
            }`}
          />
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-gray-900">
              Résultats de la migration
            </span>
            {isRunning && (
              <RefreshCw size={11} className="text-indigo-500 animate-spin" />
            )}
            {hasLogs && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {liveLogs.length} logs
              </span>
            )}
          </div>
        </div>

        {/* Actions d'en-tête (Arrêter ou Effacer) */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              type="button"
              onClick={onStop}
              disabled={isStopping}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold transition-colors disabled:opacity-50"
              title="Arrêter la migration en cours"
            >
              <Square size={10} fill="currentColor" />
              <span>{isStopping ? 'Arrêt…' : 'Arrêter'}</span>
            </button>
          )}

          {!isRunning && (hasLogs || hasResult) && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
              title="Effacer la console"
            >
              <Trash2 size={12} />
              <span>Effacer</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Corps des résultats et logs ── */}
      <div
        ref={consoleRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-slate-50/40"
      >
        {/* ── 1. Carte Migration en cours (Temps Réel) ── */}
        {isRunning && (
          <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl p-4 space-y-3 shadow-xs animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw size={15} className="text-indigo-600 animate-spin" />
                <span className="text-[12px] font-bold text-indigo-950">
                  Migration en cours…
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase bg-indigo-200/60 text-indigo-800">
                {sourceMode === 'google_sheet' ? 'Google Sheet' : 'Excel local'}
              </span>
            </div>

            {/* Action en cours */}
            {progress?.current_action && (
              <p className="text-[11px] text-indigo-700/90 leading-snug">
                Étape :{' '}
                <strong className="font-semibold text-indigo-950">
                  {progress.current_action}
                </strong>
              </p>
            )}

            {/* Barre de progression fluide */}
            <div className="h-2 w-full bg-indigo-200/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${
                    progress && progress.total > 0
                      ? progress.percent
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Compteurs live */}
            <div className="flex items-center justify-between text-[10px] font-mono pt-1">
              <span className="font-bold text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded border border-indigo-200/60">
                {progress && progress.total > 0
                  ? `${progress.current} / ${progress.total} (${progress.percent}%)`
                  : 'Pré-scan…'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ {progress?.success ?? 0} succès
                </span>
                <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  ✗ {progress?.failed ?? 0} échec
                  {(progress?.failed ?? 0) > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. État initial accueillant (Console vide) ── */}
        {!isRunning && !hasLogs && !hasResult && (
          <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
            <div className="w-16 h-16 bg-indigo-50/90 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-indigo-100 shadow-xs">
              <FolderDown size={28} strokeWidth={1.75} />
            </div>

            <h3 className="text-[14px] font-bold text-gray-800">
              Prêt pour la migration média
            </h3>

            <p className="text-[11px] text-gray-500 mt-1.5 max-w-[300px] leading-relaxed">
              Configurez votre source et votre dossier Google Drive à gauche,
              puis cliquez sur{' '}
              <strong className="text-gray-700 font-semibold">
                « Démarrer la Migration »
              </strong>
              . Les transferts en direct, les déduplications et les rapports
              s'afficheront ici.
            </p>

            {/* Aperçu de la configuration */}
            {(spreadsheetId || excelFile || driveFolderId) && (
              <div className="mt-5 p-3 rounded-lg bg-white border border-gray-200/80 shadow-xs max-w-[300px] w-full text-left space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                  <Sparkles size={11} className="text-indigo-500" />
                  Configuration prête
                </div>
                <p className="text-[11px] font-semibold text-gray-900 truncate">
                  {sourceMode === 'google_sheet'
                    ? spreadsheetId || 'Google Sheet sélectionné'
                    : excelFile?.name || 'Fichier Excel sélectionné'}
                </p>
                {driveFolderId && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 text-[10px] text-gray-500 font-mono truncate">
                    <span className="text-gray-400">Drive :</span>
                    <span className="truncate">{driveFolderId}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 3. Carte de Synthèse du Résultat ── */}
        {hasResult && (
          <div className="bg-white border border-gray-200/90 rounded-xl p-4 space-y-3 shadow-xs animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-[12px] font-bold text-gray-900">
                  Opération terminée
                </span>
              </div>
              {result.failed_items && result.failed_items.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    downloadErrorCsv(result.failed_items!, 'migration_directe')
                  }
                  className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold transition-colors"
                >
                  <Download size={11} />
                  <span>Rapport d'erreurs (CSV)</span>
                </button>
              )}
            </div>

            {/* Grille des statistiques */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="bg-emerald-50/60 border border-emerald-200/60 p-2.5 rounded-lg text-center">
                <p className="text-[9px] text-emerald-700 uppercase font-bold tracking-wider">
                  Succès
                </p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5">
                  {result.success}
                </p>
              </div>

              <div
                className={`p-2.5 rounded-lg text-center border ${
                  result.failed > 0
                    ? 'bg-rose-50/60 border-rose-200/60 text-rose-700'
                    : 'bg-gray-50 border-gray-200/60 text-gray-400'
                }`}
              >
                <p className="text-[9px] uppercase font-bold tracking-wider">
                  Échecs
                </p>
                <p
                  className={`text-xl font-bold mt-0.5 ${
                    result.failed > 0 ? 'text-rose-700' : 'text-gray-400'
                  }`}
                >
                  {result.failed}
                </p>
              </div>

              {(result.skipped_duplicates ?? 0) > 0 && (
                <div className="col-span-2 sm:col-span-1 bg-sky-50/60 border border-sky-200/60 p-2.5 rounded-lg text-center">
                  <p className="text-[9px] text-sky-700 uppercase font-bold tracking-wider">
                    Dédupliqués
                  </p>
                  <p className="text-xl font-bold text-sky-700 mt-0.5">
                    {result.skipped_duplicates}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4. Flux des Logs en Temps Réel (Thème Clair Lisible) ── */}
        {hasLogs && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
              Détail des opérations ({liveLogs.length})
            </div>
            {liveLogs.map((log, i) => {
              const isSuccess = log.startsWith('✅');
              const isError = log.startsWith('❌') || log.startsWith('⚠️');
              const isDedup = log.startsWith('♻️');

              return (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border text-[11px] leading-relaxed transition-colors ${
                    isSuccess
                      ? 'bg-emerald-50/70 border-emerald-200/70 text-emerald-950 font-medium'
                      : isError
                      ? 'bg-rose-50/70 border-rose-200/70 text-rose-950 font-medium'
                      : isDedup
                      ? 'bg-sky-50/80 border-sky-200/80 text-sky-950 font-semibold'
                      : 'bg-white border-gray-200/80 text-gray-700 shadow-2xs'
                  }`}
                >
                  <p className="break-words">{log}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composant Principal MediaPage ───────────────────────────────────────────

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

  const [sourceMode, setSourceMode] = useState<SourceMode>(
    saved?.sourceMode || 'google_sheet'
  );

  // Configuration Google Sheet
  const [config, setConfig] = useState<SheetConfig>(
    saved?.config || {
      spreadsheet_id: '',
      sheet_name: '',
      drive_folder_id: '',
    }
  );
  const [updateLinksSheet, setUpdateLinksSheet] = useState(
    saved?.updateLinksSheet ?? true
  );

  // Configuration Excel local
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelDriveFolderId, setExcelDriveFolderId] = useState(
    saved?.excelDriveFolderId || ''
  );
  const [excelSheetName, setExcelSheetName] = useState(
    saved?.excelSheetName || ''
  );
  const [updateLinks, setUpdateLinks] = useState(saved?.updateLinks ?? true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mappings spécifiques par onglet
  const [mappings, setMappings] = useState<{ sheet: string; folder: string }[]>(
    saved?.mappings || []
  );

  // Modal de confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // État de l'exécution & résultats
  const [result, setResult] = useState<MediaMigrationResult | null>(null);
  const [progress, setProgress] = useState<MediaMigrationProgress | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [isStopping, setIsStopping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

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
  }, [
    sourceMode,
    config,
    excelDriveFolderId,
    excelSheetName,
    updateLinks,
    updateLinksSheet,
    mappings,
  ]);

  // Statut de connexion Google
  useEffect(() => {
    api
      .get('/google/status')
      .then((res) => setGoogleConnected(res.data.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  // ── Mutation Google Sheet ──
  const migrateMutation = useMutation<
    AxiosResponse<MediaMigrationResponse>,
    AxiosError<ApiErrorBody>,
    SheetConfig & { update_links: boolean }
  >({
    mutationFn: (data) =>
      api.post<MediaMigrationResponse>('/media/migrate', data),
    onSuccess: (res) => {
      setResult(res.data.results);
      queryClient.invalidateQueries({ queryKey: ['media-history'] });
      // Récupérer le dernier état des logs
      api.get('/media/status').then((statusRes) => {
        if (statusRes.data.logs) setLiveLogs(statusRes.data.logs);
        if (statusRes.data.progress) setProgress(statusRes.data.progress);
      });
      toast.success(
        updateLinksSheet
          ? 'Migration terminée — liens mis à jour dans le Google Sheet !'
          : 'Photos uploadées sur Drive avec succès !'
      );
    },
    onError: handleApiError,
  });

  // ── Mutation Excel local ──
  const migrateExcelMutation = useMutation<
    void,
    AxiosError<ApiErrorBody>,
    FormData
  >({
    mutationFn: async (formData) => {
      const wantsUpdate = formData.get('update_links') === 'true';

      if (wantsUpdate) {
        // Mode mise à jour : réponse binaire Excel
        const response = await api.post('/media/migrate-excel', formData, {
          responseType: 'blob',
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const contentDisposition =
          response.headers['content-disposition'] || '';
        const fnMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        const filename = fnMatch ? fnMatch[1] : 'migrated.xlsx';
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Mode upload seul : réponse JSON
        const response = await api.post<MediaMigrationResponse>(
          '/media/migrate-excel',
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );
        setResult(response.data.results);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-history'] });
      api.get('/media/status').then((res) => {
        if (res.data.logs) setLiveLogs(res.data.logs);
        if (res.data.progress) setProgress(res.data.progress);
        if (res.data.last_stats) setResult(res.data.last_stats);
      });
      if (updateLinks) {
        toast.success(
          'Migration terminée — fichier Excel modifié téléchargé !'
        );
      } else {
        toast.success('Photos uploadées sur Drive avec succès !');
      }
    },
    onError: handleApiError,
  });

  function handleApiError(err: AxiosError<ApiErrorBody>) {
    const status = err.response?.status;
    const msg =
      (err.response?.data as ApiErrorBody)?.message || 'Erreur inconnue';
    if (status === 401) {
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <span className="font-medium text-rose-500">
              Session Google expirée
            </span>
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
        ),
        { duration: 6000 }
      );
    } else {
      toast.error(msg);
    }
  }

  const isRunning =
    migrateMutation.isPending || migrateExcelMutation.isPending;

  // Auto-scroll de la console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [liveLogs]);

  // Polling temps réel du statut et des logs
  useEffect(() => {
    let interval: number | undefined;
    if (isRunning) {
      interval = window.setInterval(async () => {
        try {
          const res = await api.get('/media/status');
          if (res.data.logs) setLiveLogs(res.data.logs);
          if (res.data.progress) setProgress(res.data.progress);
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 750);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const extractGoogleId = (value: string) => {
    if (!value) return '';
    const match = value.match(/[-\w]{25,}/);
    return match ? match[0] : value.trim();
  };

  // Drag & Drop
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

  // Construction du dictionnaire de mapping
  const buildMigrationPayload = useCallback(() => {
    const mappingRecord: Record<string, string> = {};
    mappings.forEach((m) => {
      if (m.sheet.trim() && m.folder.trim()) {
        mappingRecord[m.sheet.trim()] = extractGoogleId(m.folder);
      }
    });
    return mappingRecord;
  }, [mappings]);

  // Validation rigoureuse puis ouverture du modal de confirmation
  const handleStartClick = () => {
    if (!navigator.onLine) {
      toast.error('Vérifiez votre connexion Internet.');
      return;
    }
    if (!googleConnected) {
      toast.error(
        'Veuillez connecter votre compte Google avant de lancer la migration.'
      );
      return;
    }

    if (sourceMode === 'google_sheet') {
      if (!config.spreadsheet_id.trim()) {
        toast.error(
          'Veuillez renseigner le lien ou l’identifiant du Google Sheet source.'
        );
        return;
      }
      if (!config.drive_folder_id.trim()) {
        toast.error(
          'Veuillez renseigner le dossier Google Drive de destination.'
        );
        return;
      }
    } else {
      if (!excelFile) {
        toast.error('Veuillez sélectionner un fichier Excel (.xlsx ou .xls).');
        return;
      }
      if (!excelDriveFolderId.trim()) {
        toast.error(
          'Veuillez renseigner le dossier Google Drive de destination.'
        );
        return;
      }
    }

    // Tous les champs sont valides ➔ Afficher le modal de confirmation
    setShowConfirmModal(true);
  };

  // Démarrage effectif après confirmation dans le modal
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
        sheet_folder_mapping:
          Object.keys(mappingRecord).length > 0 ? mappingRecord : undefined,
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

  const handleClearConsole = () => {
    setLiveLogs([]);
    setResult(null);
    setProgress(null);
  };

  const addMapping = () =>
    setMappings([...mappings, { sheet: '', folder: '' }]);
  const removeMapping = (i: number) =>
    setMappings(mappings.filter((_, idx) => idx !== i));
  const updateMapping = (
    i: number,
    field: 'sheet' | 'folder',
    value: string
  ) => {
    const n = [...mappings];
    n[i][field] = value;
    setMappings(n);
  };

  return (
    <div className="page-shell-narrow">
      {/* ── Modal de confirmation ── */}
      <ConfirmModal
        open={showConfirmModal}
        sourceMode={sourceMode}
        spreadsheetId={config.spreadsheet_id}
        sheetName={
          sourceMode === 'google_sheet' ? config.sheet_name : excelSheetName
        }
        excelFile={excelFile}
        driveFolderId={
          sourceMode === 'google_sheet'
            ? config.drive_folder_id
            : excelDriveFolderId
        }
        mappings={mappings}
        updateLinks={
          sourceMode === 'google_sheet' ? updateLinksSheet : updateLinks
        }
        onConfirm={handleConfirmedMigrate}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* ── En-tête de la page ── */}
      <div className="page-header">
        <div>
          <p className="page-kicker">Google Drive</p>
          <h1 className="page-title">Migration Média</h1>
          <p className="page-subtitle max-w-lg">
            Transfert automatisé des photos Kobo vers Google Drive avec
            remise en forme des liens.
          </p>
        </div>
        <div
          className={`status-pill ${
            googleConnected
              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
              : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}
        >
          <ShieldCheck size={11} />
          <span>
            {googleConnected
              ? 'Mode Direct Actif'
              : 'Vérifiez la connexion Google'}
          </span>
        </div>
      </div>

      {/* ── Disposition en grille (Formulaire + Résultats) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] gap-6">
        {/* Colonne de Gauche : Formulaire & Historique */}
        <div className="space-y-6 flex flex-col">
          <div className="surface-panel p-5 lg:p-6 space-y-6">
            {/* Sélecteur de source */}
            <div>
              <label className="label-linear mb-2 block">
                Source des données
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Google Sheet */}
                <button
                  type="button"
                  onClick={() => setSourceMode('google_sheet')}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    sourceMode === 'google_sheet'
                      ? 'border-indigo-500 bg-indigo-50/70'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      sourceMode === 'google_sheet'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Sheet size={16} />
                  </div>
                  <div>
                    <p
                      className={`text-[12px] font-semibold ${
                        sourceMode === 'google_sheet'
                          ? 'text-indigo-900'
                          : 'text-gray-700'
                      }`}
                    >
                      Google Sheet
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Lien mis à jour en direct
                    </p>
                  </div>
                </button>

                {/* Fichier Excel local */}
                <button
                  type="button"
                  onClick={() => setSourceMode('excel_local')}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    sourceMode === 'excel_local'
                      ? 'border-emerald-500 bg-emerald-50/70'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      sourceMode === 'excel_local'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <p
                      className={`text-[12px] font-semibold ${
                        sourceMode === 'excel_local'
                          ? 'text-emerald-900'
                          : 'text-gray-700'
                      }`}
                    >
                      Fichier Excel local
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Fichier modifié à télécharger
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Formulaire Google Sheet ── */}
            {sourceMode === 'google_sheet' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="label-linear">
                    Lien du Google Sheet Source
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                      <LinkIcon size={14} />
                    </div>
                    <input
                      className="input-linear pl-8"
                      placeholder="ID ou URL complète du Google Sheet"
                      value={config.spreadsheet_id}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          spreadsheet_id: extractGoogleId(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="label-linear">
                      Nom de l'onglet (Optionnel)
                    </label>
                    <input
                      className="input-linear"
                      placeholder="Par défaut : tous"
                      value={config.sheet_name}
                      onChange={(e) =>
                        setConfig({ ...config, sheet_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-linear">
                      Dossier Drive Principal
                    </label>
                    <input
                      className="input-linear"
                      placeholder="ID ou URL du dossier Drive"
                      value={config.drive_folder_id}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          drive_folder_id: extractGoogleId(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                {/* Bannière contextuelle Sheet */}
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl border transition-all ${
                    updateLinksSheet
                      ? 'bg-indigo-50/80 border-indigo-100'
                      : 'bg-sky-50/80 border-sky-100'
                  }`}
                >
                  {updateLinksSheet ? (
                    <LinkIcon
                      size={14}
                      className="text-indigo-600 mt-0.5 shrink-0"
                    />
                  ) : (
                    <Upload
                      size={14}
                      className="text-sky-600 mt-0.5 shrink-0"
                    />
                  )}
                  <p
                    className={`text-[11px] leading-relaxed ${
                      updateLinksSheet ? 'text-indigo-800' : 'text-sky-800'
                    }`}
                  >
                    {updateLinksSheet ? (
                      <>
                        Les URLs Kobo dans le Sheet seront{' '}
                        <strong>remplacées par des liens Drive</strong> en
                        direct.
                      </>
                    ) : (
                      <>
                        Les photos seront <strong>uploadées sur Drive</strong>{' '}
                        mais le Google Sheet ne sera <strong>pas modifié</strong>.
                      </>
                    )}
                  </p>
                </div>

                {/* Toggle mise à jour des liens Sheet */}
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">
                      Mettre à jour les liens dans le Sheet
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {updateLinksSheet
                        ? 'Les URLs Kobo seront remplacées par des liens Drive'
                        : 'Upload uniquement — Google Sheet non modifié'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUpdateLinksSheet(!updateLinksSheet)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      updateLinksSheet ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        updateLinksSheet ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* ── Formulaire Excel local ── */}
            {sourceMode === 'excel_local' && (
              <div className="space-y-4">
                {/* Zone Drag & Drop */}
                <div className="space-y-1.5">
                  <label className="label-linear">Fichier Excel (.xlsx)</label>
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                      isDragging
                        ? 'border-emerald-400 bg-emerald-50'
                        : excelFile
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/20'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setExcelFile(f);
                      }}
                    />
                    {excelFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                          <FileSpreadsheet size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-[12px] font-bold text-emerald-900">
                            {excelFile.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {(excelFile.size / 1024).toFixed(1)} Ko — Cliquer
                            pour changer
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-2.5 bg-gray-100 text-gray-400 rounded-xl">
                          <Upload size={18} />
                        </div>
                        <p className="text-[12px] font-semibold text-gray-600">
                          Glisser-déposer ou cliquer pour sélectionner
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Format .xlsx ou .xls uniquement
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="label-linear">
                      Nom de l'onglet (Optionnel)
                    </label>
                    <input
                      className="input-linear"
                      placeholder="Par défaut : tous"
                      value={excelSheetName}
                      onChange={(e) => setExcelSheetName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-linear">
                      Dossier Drive Principal
                    </label>
                    <input
                      className="input-linear"
                      placeholder="ID ou URL du dossier Drive"
                      value={excelDriveFolderId}
                      onChange={(e) =>
                        setExcelDriveFolderId(extractGoogleId(e.target.value))
                      }
                    />
                  </div>
                </div>

                {/* Bannière contextuelle Excel */}
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl border transition-all ${
                    updateLinks
                      ? 'bg-emerald-50/80 border-emerald-100'
                      : 'bg-sky-50/80 border-sky-100'
                  }`}
                >
                  {updateLinks ? (
                    <Download
                      size={14}
                      className="text-emerald-600 mt-0.5 shrink-0"
                    />
                  ) : (
                    <Upload
                      size={14}
                      className="text-sky-600 mt-0.5 shrink-0"
                    />
                  )}
                  <p
                    className={`text-[11px] leading-relaxed ${
                      updateLinks ? 'text-emerald-800' : 'text-sky-800'
                    }`}
                  >
                    {updateLinks ? (
                      <>
                        Le fichier Excel avec les <strong>liens Drive</strong>{' '}
                        sera <strong>téléchargé automatiquement</strong>.
                      </>
                    ) : (
                      <>
                        Les photos seront <strong>uploadées sur Drive</strong>{' '}
                        mais le fichier Excel ne sera <strong>pas modifié</strong>.
                      </>
                    )}
                  </p>
                </div>

                {/* Toggle mise à jour des liens Excel */}
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">
                      Mettre à jour les liens dans le fichier
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {updateLinks
                        ? 'Les URLs Kobo seront remplacées par des liens Drive'
                        : 'Upload uniquement — fichier Excel non modifié'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUpdateLinks(!updateLinks)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      updateLinks ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        updateLinks ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* ── Configuration par onglet (commun) ── */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Configuration par onglet (Optionnel)
                </label>
                <button
                  type="button"
                  onClick={addMapping}
                  className="flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 transition-colors"
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
                      onChange={(e) =>
                        updateMapping(i, 'sheet', e.target.value)
                      }
                    />
                    <input
                      className="input-linear !h-9 text-[11px] flex-[1.5]"
                      placeholder="ID du dossier Drive"
                      value={m.folder}
                      onChange={(e) =>
                        updateMapping(
                          i,
                          'folder',
                          extractGoogleId(e.target.value)
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeMapping(i)}
                      className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Bouton d'action principal ── */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleStartClick}
                disabled={isRunning}
                className="btn-primary-linear !h-10 !px-6"
              >
                {isRunning ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Migration en cours…</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Play size={12} fill="currentColor" />
                    <span>Démarrer la Migration</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* ── Section Historique Persistant ── */}
          <HistorySection />
        </div>

        {/* Colonne de Droite : Console & Résultats Harmonisée */}
        <div>
          <MediaConsole
            consoleRef={consoleRef}
            isRunning={isRunning}
            isStopping={isStopping}
            progress={progress}
            liveLogs={liveLogs}
            result={result}
            sourceMode={sourceMode}
            spreadsheetId={config.spreadsheet_id}
            excelFile={excelFile}
            driveFolderId={
              sourceMode === 'google_sheet'
                ? config.drive_folder_id
                : excelDriveFolderId
            }
            onStop={handleStop}
            onClear={handleClearConsole}
          />
        </div>
      </div>
    </div>
  );
};

export default MediaPage;
