import type { RefObject } from 'react';
import { Activity, CheckCircle, Download, ExternalLink, FileSpreadsheet } from 'lucide-react';
import api from '../../api/client';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface ExportConsoleProps {
  consoleRef: RefObject<HTMLDivElement>;
  form: UseExportFormReturn;
}

/**
 * Déclenche le téléchargement direct d'un fichier exporté depuis le serveur.
 * Crée un lien <a> temporaire avec l'URL de l'endpoint /exports/download.
 */
function downloadFile(filePath: string, fileName: string) {
  const encoded = encodeURIComponent(filePath);
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
  const url = `${baseURL}/exports/download?path=${encoded}`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const ExportConsole = ({ consoleRef, form }: ExportConsoleProps) => (
  <div className="console-wrapper h-[660px]">
    <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full ${form.exportMutation.isPending ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`} />
      <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em]">Console de Sortie</span>
    </div>
    <div ref={consoleRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar custom-scrollbar-dark font-mono text-[11px] leading-relaxed">
      {!form.exportMutation.isPending && !form.result && (
        <div className="text-center py-40 opacity-10 flex flex-col items-center">
          <Activity size={48} strokeWidth={1} className="text-white mb-4" />
          <p className="uppercase tracking-[0.4em] text-white">Standby</p>
        </div>
      )}
      {form.exportMutation.isPending && (
        <div className="space-y-3 animate-pulse">
          <p className="text-indigo-400">{" [SYSTEM] Initialisation de la fusion..."}</p>
          <p className="text-white/60">{" [PARAMS] Format : " + form.exportFormat.toUpperCase()}</p>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 animate-[indeterminate_2s_infinite]"></div>
          </div>
        </div>
      )}
      {form.result && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-[10px]">
              <CheckCircle size={14} /> Opération terminée
            </div>
            {/* Bouton de téléchargement global — télécharge le premier fichier si un seul fichier */}
            {form.result.files.length === 1 && (
              <button
                onClick={() => {
                  const f = form.result!.files[0];
                  const fileName = f.path.split(/[/\\]/).pop() ?? 'export';
                  downloadFile(f.path, fileName);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-full transition-all text-[10px] font-bold uppercase tracking-tighter"
              >
                <Download size={12} />
                Télécharger
              </button>
            )}
          </div>
          <div className="grid gap-2">
            {form.result.files.map((f, i) => (
              <div key={i} className="p-3 bg-white/[0.03] border border-white/5 rounded-lg group transition-all">
                <div className="flex items-center gap-3">
                  <div className="bg-white/5 p-2 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                    <FileSpreadsheet size={14} className="text-white/40 group-hover:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-white/90 truncate uppercase tracking-tight italic">{f.site}</p>
                    <p className="text-[9px] text-indigo-400/70 truncate font-mono mt-0.5">{f.path.split(/[/\\]/).pop()}</p>
                    <p className="text-[10px] text-white/40 mt-1">{f.rows} soumissions traitées</p>
                  </div>
                  {/* Actions par fichier : télécharger + ouvrir dans Drive si disponible */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {/* 1️⃣ Téléchargement direct */}
                    <button
                      onClick={() => {
                        const fileName = f.path.split(/[/\\]/).pop() ?? 'export';
                        downloadFile(f.path, fileName);
                      }}
                      title="Télécharger le fichier"
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-full transition-all text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap"
                    >
                      <Download size={10} />
                      Télécharger
                    </button>
                    {/* 2️⃣ Lien Drive (seulement si le fichier a été uploadé sur Drive) */}
                    {f.drive_link && (
                      <a
                        href={f.drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ouvrir dans Google Drive"
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-full transition-all text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap"
                      >
                        <ExternalLink size={10} />
                        Drive
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Résumé Drive global si plusieurs fichiers uploadés */}
          {(form.result.drive_success ?? 0) > 0 && (
            <div className="mt-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-[9px] text-emerald-400 font-bold uppercase tracking-tighter">
              <ExternalLink size={10} />
              {form.result.drive_success} fichier(s) envoyé(s) sur Google Drive. Cliquez sur "Drive" pour ouvrir.
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
