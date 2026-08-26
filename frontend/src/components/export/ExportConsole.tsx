import type { RefObject } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderDown,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../../api/client';
import type { UseExportFormReturn } from '../../hooks/useExportForm';
import type { SessionExportItem } from '../../types/export';

interface ExportConsoleProps {
  consoleRef: RefObject<HTMLDivElement>;
  form: UseExportFormReturn;
}

/**
 * Déclenche le téléchargement direct d'un fichier exporté depuis le serveur.
 * Vérifie si le fichier est présent sur le serveur (cas des disques éphémères Render après redémarrage).
 */
async function downloadFile(filePath: string, fileName: string) {
  const encoded = encodeURIComponent(filePath);
  const baseURL = getApiBaseUrl();
  const url = `${baseURL}/exports/download?path=${encoded}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        toast.error(
          "Ce fichier n'est plus présent sur le serveur local (stockage réinitialisé après redéploiement). Utilisez le lien Google Drive si activé.",
          { duration: 6000 }
        );
        return;
      }
      throw new Error(`Erreur ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    console.error("Erreur téléchargement :", err);
    toast.error("Impossible de télécharger le fichier local.");
  }
}

export const ExportConsole = ({ consoleRef, form }: ExportConsoleProps) => {
  const isPending = form.exportMutation.isPending;
  const history = form.exportHistory || [];
  const hasHistory = history.length > 0;

  return (
    <div className="surface-panel overflow-hidden flex flex-col h-[700px] bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* ── En-tête : Résultats des exports ── */}
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isPending
                ? 'bg-indigo-600 animate-ping'
                : hasHistory
                ? 'bg-emerald-500'
                : 'bg-gray-300'
            }`}
          />
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-gray-900">
              Résultats des exports
            </span>
            {form.loadingHistory && (
              <RefreshCw size={11} className="text-indigo-500 animate-spin" />
            )}
            {hasHistory && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {history.length}
              </span>
            )}
          </div>
        </div>

        {/* Action : Effacer l'historique de la session & base de données */}
        {hasHistory && !isPending && (
          <button
            type="button"
            onClick={form.clearExportHistory}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
            title="Effacer tout l'historique des exports de la base de données"
          >
            <Trash2 size={12} />
            <span>Effacer</span>
          </button>
        )}
      </div>

      {/* ── Corps de l'historique / États ── */}
      <div
        ref={consoleRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/40"
      >
        {/* ── 1. Carte Export en cours ── */}
        {isPending && (
          <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl p-4 space-y-3 shadow-xs animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw size={15} className="text-indigo-600 animate-spin" />
                <span className="text-[12px] font-bold text-indigo-900">
                  Exportation en cours…
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase bg-indigo-200/60 text-indigo-800">
                {form.exportFormat}
              </span>
            </div>

            <p className="text-[11px] text-indigo-700/90 leading-snug">
              Fusion et génération des fichiers en cours pour{' '}
              <strong className="font-semibold text-indigo-950">
                {form.selectedFormName || 'le formulaire sélectionné'}
              </strong>
              .
            </p>

            {/* Barre de progression fluide */}
            <div className="h-1.5 w-full bg-indigo-200/50 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full animate-[indeterminate_1.8s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {/* ── 2. État vide accueillant (aucun export en base ni dans la session) ── */}
        {!isPending && !hasHistory && (
          <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
            <div className="w-16 h-16 bg-indigo-50/90 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-indigo-100 shadow-xs">
              <FolderDown size={28} strokeWidth={1.75} />
            </div>

            <h3 className="text-[14px] font-bold text-gray-800">
              Prêt pour l'exportation
            </h3>

            <p className="text-[11px] text-gray-500 mt-1.5 max-w-[280px] leading-relaxed">
              Configurez vos options à gauche et cliquez sur{' '}
              <strong className="text-gray-700 font-semibold">
                « Lancer l'Export »
              </strong>
              . Les fichiers générés, liens de téléchargement et accès Google
              Drive apparaîtront ici et seront conservés dans votre historique.
            </p>

            {/* Aperçu rapide de la configuration prête */}
            {form.selectedFormName && (
              <div className="mt-5 p-3 rounded-lg bg-white border border-gray-200/80 shadow-xs max-w-[280px] w-full text-left space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                  <Sparkles size={11} className="text-indigo-500" />
                  Prêt à exporter
                </div>
                <p className="text-[11px] font-semibold text-gray-900 truncate">
                  {form.selectedFormName}
                </p>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100 text-[10px] text-gray-500">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono font-bold uppercase text-gray-700 text-[9px]">
                    {form.exportFormat}
                  </span>
                  <span>
                    {form.selectedSheets.length} onglet(s) sélectionné(s)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Liste empilée des exports précédents (plus récents en haut) ── */}
        {history.map((item, index) => (
          <ExportHistoryCard key={item.id || index} item={item} />
        ))}
      </div>
    </div>
  );
};

interface ExportHistoryCardProps {
  item: SessionExportItem;
}

/**
 * Carte individuelle représentant un export enregistré en base de données.
 */
const ExportHistoryCard = ({ item }: ExportHistoryCardProps) => {
  const isSuccess = item.status === 'success';
  const isCancelled = item.status === 'cancelled';
  const isError = item.status === 'error';
  const driveErrors = item.driveErrors ?? [];
  const driveSuccessCount = item.driveSuccess ?? 0;

  return (
    <div className="bg-white border border-gray-200/90 rounded-xl p-3.5 space-y-3 shadow-xs hover:border-indigo-200 transition-all">
      {/* En-tête de la carte */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            {isSuccess && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 size={11} className="text-emerald-600" />
                Export réussi
              </span>
            )}
            {isCancelled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <AlertTriangle size={11} className="text-amber-600" />
                Interrompu
              </span>
            )}
            {isError && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                <XCircle size={11} className="text-red-600" />
                Échec
              </span>
            )}

            <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] uppercase bg-gray-100 text-gray-700 border border-gray-200">
              {item.format}
            </span>
          </div>

          <p
            className="text-[12px] font-bold text-gray-900 truncate pt-0.5"
            title={item.formName}
          >
            {item.formName}
          </p>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1 text-[10px] font-mono text-gray-400 shrink-0">
          <Clock size={11} />
          <span>{item.timestamp}</span>
        </div>
      </div>

      {/* Message d'erreur global si présent */}
      {item.errorMessage && (
        <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-[10px] text-red-700 leading-relaxed">
          <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
          <span>{item.errorMessage}</span>
        </div>
      )}

      {/* Liste des fichiers générés */}
      {item.files && item.files.length > 0 && (
        <div className="space-y-2">
          {item.files.map((file, fIdx) => {
            const fileName = file.path.split(/[/\\]/).pop() ?? 'export';
            const isLocalAvailable = file.server_file_exists !== false;
            const hasDrive = Boolean(file.drive_link);

            return (
              <div
                key={fIdx}
                className="p-2.5 bg-slate-50/80 hover:bg-slate-50 border border-gray-200/80 rounded-lg flex items-center justify-between gap-2.5 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                    isLocalAvailable
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : hasDrive
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}>
                    <FileSpreadsheet size={14} />
                  </div>

                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-bold text-gray-900 truncate"
                      title={file.site || fileName}
                    >
                      {file.site || fileName}
                    </p>
                    <div className="flex items-center gap-2 text-[9px] text-gray-500 font-mono">
                      <span className="truncate max-w-[120px]" title={fileName}>
                        {fileName}
                      </span>
                      <span>•</span>
                      <span className="text-gray-400 font-sans">
                        {file.rows} ligne(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Boutons d'action par fichier */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 1. Téléchargement direct (si disponible sur le serveur) */}
                  {isLocalAvailable ? (
                    <button
                      type="button"
                      onClick={() => void downloadFile(file.path, fileName)}
                      title="Télécharger directement ce fichier depuis le serveur"
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-semibold transition-colors shadow-xs"
                    >
                      <Download size={11} />
                      <span>Télécharger</span>
                    </button>
                  ) : (
                    <span
                      title="Ce fichier n'est plus présent sur le serveur (le disque Render a été réinitialisé suite à un redéploiement)."
                      className="px-2 py-1 bg-gray-100 text-gray-400 border border-gray-200 rounded-md text-[9px] font-medium cursor-help flex items-center gap-1"
                    >
                      <span>Expiré (serveur)</span>
                    </span>
                  )}

                  {/* 2. Lien Drive si disponible */}
                  {hasDrive && (
                    <a
                      href={file.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir le fichier permanent dans Google Drive"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                        !isLocalAvailable
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      <ExternalLink size={11} />
                      <span>Drive</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Résumé Drive succès */}
      {driveSuccessCount > 0 && driveErrors.length === 0 && (
        <div className="p-2 bg-emerald-50/70 border border-emerald-200/60 rounded-lg flex items-center gap-2 text-[10px] text-emerald-800 font-medium">
          <ExternalLink size={12} className="text-emerald-600 shrink-0" />
          <span>
            {driveSuccessCount} fichier(s) synchronisé(s) sur Google Drive.
          </span>
        </div>
      )}

      {/* Avertissement / Erreurs Drive */}
      {driveErrors.length > 0 && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1 text-[10px] text-amber-900 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[10px]">
            <AlertTriangle size={12} className="text-amber-600 shrink-0" />
            <span>
              {driveSuccessCount > 0
                ? `${driveSuccessCount} envoyé(s), ${driveErrors.length} échec(s) Drive :`
                : "Échec de synchronisation Google Drive :"}
            </span>
          </div>
          {driveErrors.map((err, errIdx) => (
            <p key={errIdx} className="font-mono text-[9px] text-amber-800/90 break-all pl-4">
              • {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

