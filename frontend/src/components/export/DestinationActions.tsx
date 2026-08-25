import { Link, RefreshCw, Send } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface DestinationActionsProps {
  form: UseExportFormReturn;
}

/**
 * Extrait l'ID d'un dossier Google Drive depuis une URL complète ou un ID brut.
 * Supporte les formats :
 *   - https://drive.google.com/drive/u/0/folders/1ABC123def456
 *   - https://drive.google.com/drive/folders/1ABC123def456?usp=sharing
 *   - 1ABC123def456  (ID brut, retourné tel quel)
 */
function extractDriveFolderId(raw: string): string {
  const trimmed = raw.trim();
  // Si ça ressemble à une URL Google Drive contenant /folders/
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return trimmed;
}

export const DestinationActions = ({ form }: DestinationActionsProps) => {
  // Valeur affichée dans le champ (brute, pour que l'utilisateur voie ce qu'il a collé)
  const rawValue = form.driveFolderId;
  // ID effectivement extrait (utilisé pour l'aperçu)
  const extractedId = extractDriveFolderId(rawValue);
  const isUrl = rawValue.includes('/folders/');
  const hasValue = rawValue.trim().length > 0;

  const handleDriveInputChange = (value: string) => {
    // On stocke TOUJOURS l'ID extrait dans le state (pas l'URL brute),
    // afin que la valeur envoyée au backend soit déjà propre.
    form.setDriveFolderId(extractDriveFolderId(value));
  };

  return (
    <div className={`surface-panel p-4 space-y-4 flex flex-col ${form.selectedSheets.length === 0 ? 'step-locked' : ''}`}>
      <div className="section-label">
        <Link size={13} className="text-gray-400" />
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">4. Destination &amp; Lancement <span className="text-red-500">*</span></span>
      </div>
      <div className="space-y-4 flex-1 flex flex-col">
        <div className="space-y-3">
          <div className="space-y-1">
            <input
              className="input-linear"
              placeholder="ID ou URL du dossier Google Drive (optionnel)"
              value={isUrl ? rawValue : extractedId}
              onChange={e => handleDriveInputChange(e.target.value)}
            />
            {/* Feedback visuel : affiche l'ID extrait si l'utilisateur a collé une URL */}
            {hasValue && (
              <div className="flex items-center gap-1.5 px-1">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUrl ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <p className="text-[8px] font-mono truncate text-white/40">
                  {isUrl
                    ? `ID extrait : ${extractedId}`
                    : `ID : ${extractedId}`}
                </p>
              </div>
            )}
          </div>
          {form.exportFormat === 'csv' && (
            <div className="space-y-1.5 p-2 bg-indigo-50/30 rounded-lg border border-indigo-100/50">
              <label className="text-[9px] font-bold text-indigo-700/80 uppercase tracking-wider block">Séparateur CSV</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => form.setCsvSeparator(';')}
                  className={`flex-1 py-1 rounded text-[9px] font-bold border transition-all ${
                    form.csvSeparator === ';'
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-gray-250 text-gray-400 hover:border-gray-200'
                  }`}
                >
                  POINT-VIRGULE (;)
                </button>
                <button
                  type="button"
                  onClick={() => form.setCsvSeparator(',')}
                  className={`flex-1 py-1 rounded text-[9px] font-bold border transition-all ${
                    form.csvSeparator === ','
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-gray-250 text-gray-400 hover:border-gray-200'
                  }`}
                >
                  VIRGULE (,)
                </button>
              </div>
              <p className="text-[8px] text-gray-400 italic mt-0.5 leading-tight">
                {form.csvSeparator === ';'
                  ? "Excel en français. Décimales avec des points (.)."
                  : "Standard GPS/SIG (QGIS). Import automatique."}
              </p>
            </div>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          {form.exportMutation.isPending ? (
            <button
              onClick={form.handleCancel}
              className="btn-primary-linear !h-10 w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 border-red-500 shadow-red-500/20 active:translate-y-0.5 animate-pulse"
            >
              <RefreshCw className="animate-spin text-white" size={14} />
              <span className="text-[11px] font-bold text-white uppercase tracking-[0.1em]">ARRÊTER</span>
            </button>
          ) : (
            <button
              onClick={form.handleRun}
              disabled={form.selectedSheets.length === 0}
              className="btn-primary-linear !h-10 w-full flex items-center justify-center gap-2"
            >
              <Send size={14} className="text-white" />
              <span className="text-[11px] font-bold text-white uppercase tracking-[0.1em]">Lancer l'Export</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
