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
          <div className="flex gap-2 p-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <select
              className="flex-1 bg-transparent border-none text-[10px] font-bold text-gray-600 focus:ring-0"
              value={form.csvSeparator}
              onChange={e => {
                const nextSeparator = e.target.value as CsvSeparator;
                form.setCsvSeparator(nextSeparator);
                form.setCsvEncoding(prev => normalizeCsvEncoding(nextSeparator, prev) as CsvEncoding);
              }}
            >
              <option value=";">Point-virgule</option>
              <option value=",">Virgule</option>
            </select>
            <select
              className="flex-1 bg-transparent border-none text-[10px] font-bold text-gray-600 focus:ring-0"
              value={form.csvEncoding}
              onChange={e => form.setCsvEncoding(normalizeCsvEncoding(form.csvSeparator, e.target.value) as CsvEncoding)}
            >
              <option value="utf-8-sig">UTF-8 BOM</option>
              <option value="utf-8">UTF-8 simple</option>
              <option value="windows-1252">Windows-1252</option>
            </select>
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
        <button
          onClick={form.handleRun}
          disabled={form.exportMutation.isPending || form.selectedSheets.length === 0}
          className={`btn-primary-linear !h-10 w-full flex items-center justify-center gap-2 ${form.exportMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {form.exportMutation.isPending ? <RefreshCw className="animate-spin text-white" size={14} /> : <Send size={14} className="text-white" />}
          <span className="text-[11px] font-bold text-white uppercase tracking-[0.1em]">Lancer l'Export</span>
        </button>
      </div>
    </div>
  </div>
);

