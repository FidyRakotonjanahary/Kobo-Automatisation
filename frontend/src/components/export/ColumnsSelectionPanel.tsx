import { RefreshCw, Settings2 } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface ColumnsSelectionPanelProps {
  form: UseExportFormReturn;
}

export const ColumnsSelectionPanel = ({ form }: ColumnsSelectionPanelProps) => {
  if (form.mainSheetColumns.length === 0) return null;

  return (
    <div className="border-t border-gray-100 bg-gray-50/50">
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
            <Settings2 size={15} className="text-gray-500" />
          </div>
          <div className="min-w-0">
            <span className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              Colonnes premier onglet ({form.selectedMainColumnCount}/{form.mainSheetColumns.length})
              {form.loadingColumns && <RefreshCw size={11} className="text-violet-500 animate-spin shrink-0" />}
            </span>
            <p className="text-[10px] text-gray-400 font-medium truncate">{form.mainSheet?.name}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={form.selectAllMainColumns} className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider">Tout cocher</button>
          <button onClick={form.deselectOptionalMainColumns} className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider">Tout d{"\u00e9"}cocher</button>
        </div>
      </div>
      <div className="max-h-[210px] overflow-y-auto p-4 custom-scrollbar">
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

