import { Activity, RefreshCw, Search } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface PivotFormatSelectorProps {
  form: UseExportFormReturn;
}

export const PivotFormatSelector = ({ form }: PivotFormatSelectorProps) => (
  <div className={`surface-panel p-4 space-y-4 ${!form.selectedFormName || !form.formStructure ? 'step-locked' : ''}`}>
    <div className="section-label">
      <Activity size={13} className="text-gray-400" />
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">3. Pivot G{"\u00e9"}ographique <span className="text-red-500">*</span></span>
    </div>
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Colonne des sites</label>
        <div className="flex gap-1.5">
          <select className="input-linear font-medium" value={form.pivot} onChange={e => form.setPivot(e.target.value)}>
            <option value="">-- Choisir --</option>
            {form.mainSheetColumns.map((c, index) => <option key={`${c}-${index}`} value={c}>{c}</option>)}
          </select>
          <button onClick={() => { void form.fetchSites(); }} className="btn-primary-linear !px-2.5 !bg-indigo-50 !text-indigo-600 border-indigo-100 hover:!bg-indigo-600 hover:!text-white" disabled={form.loadingSites || !form.pivot}>
            {form.loadingSites ? <RefreshCw className="animate-spin" size={13} /> : <Search size={14} />}
          </button>
        </div>
        {!form.selectedSheets[0] && <p className="text-[9px] text-red-400 italic mt-1">S{"\u00e9"}lectionnez un onglet d'abord.</p>}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="flex gap-2">
          <button onClick={() => form.setExportFormat('xlsx')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${form.exportFormat === 'xlsx' ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>EXCEL</button>
          <button onClick={() => form.setExportFormat('csv')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${form.exportFormat === 'csv' ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>CSV</button>
        </div>
      </div>
    </div>
  </div>
);

