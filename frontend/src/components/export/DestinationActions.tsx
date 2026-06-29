import { Link, RefreshCw, Send } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface DestinationActionsProps {
  form: UseExportFormReturn;
}

export const DestinationActions = ({ form }: DestinationActionsProps) => (
  <div className={`surface-panel p-4 space-y-4 flex flex-col ${form.selectedSheets.length === 0 ? 'step-locked' : ''}`}>
    <div className="section-label">
      <Link size={13} className="text-gray-400" />
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">4. Destination & Lancement <span className="text-red-500">*</span></span>
    </div>
    <div className="space-y-4 flex-1 flex flex-col">
      <div className="space-y-3">
        <input className="input-linear" placeholder="Dossier Drive (ID)" value={form.driveFolderId} onChange={e => form.setDriveFolderId(e.target.value)} />
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

