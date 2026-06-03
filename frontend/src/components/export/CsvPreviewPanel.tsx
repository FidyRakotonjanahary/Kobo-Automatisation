import { CheckCircle } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface CsvPreviewPanelProps {
  form: UseExportFormReturn;
}

export const CsvPreviewPanel = ({ form }: CsvPreviewPanelProps) => {
  if (!form.csvPreview) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300 surface-panel overflow-hidden relative z-20">
      <div className="px-6 py-3 bg-indigo-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-white" />
          <span className="text-[11px] font-bold text-white tracking-[0.2em] uppercase">Validation de structure CSV</span>
        </div>
        <button onClick={() => form.setCsvPreview(null)} className="text-white/80 hover:text-white text-[10px] font-bold px-3 py-1 bg-white/10 rounded-full transition-colors uppercase">Ignorer</button>
      </div>
      <pre className="p-6 text-[12px] font-mono whitespace-pre overflow-x-auto text-gray-800 bg-gray-50/50 custom-scrollbar max-h-[250px]">
        {form.csvPreview}
      </pre>
    </div>
  );
};

