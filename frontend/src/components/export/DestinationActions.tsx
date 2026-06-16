import { Eye, Link, RefreshCw, Send } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';
import { normalizeCsvEncoding } from '../../hooks/useExportSelection';
import type { CsvEncoding, CsvSeparator } from '../../types/export';

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
          <div className="flex items-center justify-center gap-2 p-1.5 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
            <span className="text-[9px] font-bold text-indigo-600/70 uppercase tracking-wider">CSV : Point-virgule + UTF-8 BOM</span>
          </div>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-2">
        {form.exportFormat === 'csv' && (
          <button onClick={form.handlePreview} disabled={form.loadingPreview || !form.selectedSheets[0]} className="btn-secondary-linear !h-9 w-full flex items-center justify-center gap-2">
            {form.loadingPreview ? <RefreshCw className="animate-spin text-indigo-500" size={12} /> : <Eye size={12} className="text-gray-400" />}
            <span className="uppercase tracking-wider">Aper{"\u00e7"}u</span>
          </button>
        )}
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

