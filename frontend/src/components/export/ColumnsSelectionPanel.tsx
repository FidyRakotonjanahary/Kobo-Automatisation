import { RefreshCw, Settings2 } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface ColumnsSelectionPanelProps {
  form: UseExportFormReturn;
}

export const ColumnsSelectionPanel = ({ form }: ColumnsSelectionPanelProps) => {
  if (form.mainSheetColumns.length === 0) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Settings2 size={16} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <span className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
              Colonnes premier onglet ({form.selectedMainColumnCount}/{form.mainSheetColumns.length})
              {form.loadingColumns && <RefreshCw size={11} className="text-indigo-500 animate-spin shrink-0" />}
            </span>
            <p className="text-[10px] text-gray-400 font-medium truncate">{form.mainSheet?.name}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={form.selectAllMainColumns} className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider">Tout cocher</button>
          <button onClick={form.deselectOptionalMainColumns} className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider">Tout décocher</button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {form.mainSheetColumns.map((column, index) => {
            const required = form.isRequiredMainColumn(column);
            const checked = required || form.selectedColumns.includes(column);
            return (
              <label key={`${column}-${index}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${required ? 'bg-indigo-50/70 border-indigo-100 text-indigo-700' : checked ? 'bg-white border-gray-200 text-gray-800 shadow-sm' : 'bg-white/70 border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-70"
                  checked={checked}
                  disabled={required}
                  onChange={() => form.toggleMainColumn(column)}
                />
                <span className="text-[11px] font-semibold truncate flex-1" title={column}>{column}</span>
                {required && <span className="text-[8px] font-black uppercase tracking-tight bg-white/80 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">Fixe</span>}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

