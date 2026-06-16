import type { RefObject } from 'react';
import { Activity, CheckCircle, FileSpreadsheet, FolderOpen } from 'lucide-react';
import api from '../../api/client';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface ExportConsoleProps {
  consoleRef: RefObject<HTMLDivElement>;
  form: UseExportFormReturn;
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
              <CheckCircle size={14} /> Op{"\u00e9"}ration termin{"\u00e9"}e
            </div>
            {form.result.files.length > 0 && (
              <button
                onClick={() => { void api.post('/exports/open', { path: form.result?.files[0].folder_path }); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-full transition-all text-[10px] font-bold uppercase tracking-tighter"
              >
                <FolderOpen size={12} />
                Ouvrir le dossier
              </button>
            )}
          </div>
          <div className="grid gap-2">
            {form.result.files.map((f, i) => (
              <div key={i} onClick={() => { void api.post('/exports/open', { path: f.path }); }} className="p-3 bg-white/[0.03] border border-white/5 rounded-lg hover:bg-white/[0.08] cursor-pointer group transition-all transform hover:-translate-x-1">
                <div className="flex items-center gap-3">
                    <div className="bg-white/5 p-2 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                      <FileSpreadsheet size={14} className="text-white/40 group-hover:text-emerald-400" />
                    </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-white/90 truncate uppercase tracking-tight italic">{f.site}</p>
                    <p className="text-[9px] text-indigo-400/70 truncate font-mono mt-0.5">{f.path.split(/[\\/]/).pop()}</p>
                    <p className="text-[10px] text-white/40 mt-1">{f.rows} soumissions trait{"\u00e9"}es</p>
                  </div>
                  <FileSpreadsheet size={14} className="text-white/10 group-hover:text-emerald-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

