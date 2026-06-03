import { AlertCircle, Database, Layers, RefreshCw } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface FormSheetSelectorProps {
  form: UseExportFormReturn;
}

export const FormSheetSelector = ({ form }: FormSheetSelectorProps) => (
  <div className={`surface-panel p-4 space-y-4 ${form.selectedAccountIds.length === 0 ? 'step-locked' : ''}`}>
    <div className="flex items-center justify-between">
      <div className="section-label">
        <Database size={13} className="text-gray-400" />
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">2. Formulaire & Onglets <span className="text-red-500">*</span></span>
      </div>
      {form.loadingAccountIds.length > 0 && <RefreshCw size={12} className="text-indigo-500 animate-spin" />}
    </div>
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Formulaire Source</label>
          {form.commonForms.length > 0 && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{form.commonForms.length} communs</span>}
        </div>
        <div className="relative">
          <select
            className={`input-linear font-semibold h-9 ${form.loadingAccountIds.length > 0 ? 'opacity-50' : ''}`}
            disabled={form.loadingAccountIds.length > 0 || (form.commonForms.length === 0 && form.loadingAccountIds.length === 0 && form.selectedAccountIds.length > 0)}
            value={form.selectedFormName}
            onChange={e => { void form.fetchStructure(e.target.value); }}
          >
            <option value="">{form.loadingAccountIds.length > 0 ? 'Chargement des formulaires...' : 'S\u00e9lectionner le formulaire'}</option>
            {form.commonForms.map(f => <option key={f.uid} value={f.name}>{f.name}</option>)}
          </select>
          {form.loadingAccountIds.length > 0 && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <RefreshCw className="animate-spin text-indigo-500" size={12} />
            </div>
          )}
        </div>
        {form.loadingStructure && (
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <p className="text-[10px] text-indigo-600 font-medium flex items-center gap-2">
              <RefreshCw className="animate-spin" size={10} />
              Analyse de la structure Kobo...
            </p>
          </div>
        )}
        {form.loadingColumns && (
          <div className="bg-violet-50/60 border border-violet-100 rounded-lg p-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <p className="text-[10px] text-violet-600 font-medium flex items-center gap-2">
              <RefreshCw className="animate-spin" size={10} />
              Lecture des colonnes export{"\u00e9"}es...
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5 animate-in fade-in duration-300">
        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-tight flex items-center gap-1.5">
          <Layers size={11} className="text-indigo-400" />
          Onglet(s) {"\u00e0"} exporter
        </label>
        <div className="border border-gray-200 rounded-lg bg-white overflow-y-auto max-h-[100px] px-1 py-1 space-y-0.5 custom-scrollbar bg-gray-50/30">
          {form.formStructure?.sheets.length ? (
            form.formStructure.sheets.map(sh => (
              <label key={sh.name} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${form.selectedSheets.includes(sh.name) ? 'bg-white shadow-sm ring-1 ring-indigo-100' : 'hover:bg-white/50'}`}>
                <input
                  type={form.exportFormat === 'csv' ? 'radio' : 'checkbox'}
                  name="sheet_selector"
                  className="w-3 h-3 text-indigo-600 focus:ring-0"
                  checked={form.selectedSheets.includes(sh.name)}
                  onChange={() => form.handleSheetToggle(sh.name)}
                />
                <span className={`text-[11px] truncate ${form.selectedSheets.includes(sh.name) ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{sh.name}</span>
              </label>
            ))
          ) : (
            <p className="text-[10px] text-gray-400 italic p-2 text-center">Aucun onglet charg{"\u00e9"}</p>
          )}
        </div>
        {form.exportFormat === 'csv' && form.selectedSheets.length > 0 && (
          <div className="mt-1 flex items-start gap-1 p-1 bg-amber-50 rounded border border-amber-100/50">
            <AlertCircle size={10} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[9px] text-amber-700 leading-tight italic">Mode CSV : Un seul onglet possible.</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

