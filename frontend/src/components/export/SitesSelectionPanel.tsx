import { Check, Layers, LayoutGrid, RefreshCw, Search } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface SitesSelectionPanelProps {
  form: UseExportFormReturn;
}

export const SitesSelectionPanel = ({ form }: SitesSelectionPanelProps) => (
  <>
    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <LayoutGrid size={16} className="text-indigo-600" />
        </div>
        <div>
          <span className="text-[14px] font-bold text-gray-900 block">Secteurs & Sites ({form.selectedSites.length})</span>
          <p className="text-[10px] text-gray-400 font-medium tracking-tight">S{"\u00e9"}lectionnez les lots {"\u00e0"} exporter</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => form.setSelectedSites(form.availableSites)} className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider">Tout cocher</button>
        <button onClick={() => form.setSelectedSites([])} className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider">Tout d{"\u00e9"}cocher</button>
      </div>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar">
      {!form.pivot ? (
        <div className="flex-1 flex flex-col items-center justify-center h-full text-center py-20 grayscale opacity-20">
          <Layers size={64} strokeWidth={1} className="mb-6 text-indigo-900" />
          <p className="text-[14px] font-bold uppercase tracking-[0.3em] text-gray-900">Partitionnement Inactif</p>
          <p className="text-[11px] mt-2 text-gray-500 max-w-[250px] mx-auto">Veuillez configurer un formulaire et une colonne pivot pour isoler les sites de collecte.</p>
        </div>
      ) : form.loadingSites ? (
        <div className="flex-1 flex flex-col items-center justify-center h-full py-20 text-center animate-pulse">
          <RefreshCw size={32} className="text-indigo-500 animate-spin mb-4" />
          <p className="text-[12px] font-bold text-indigo-600 uppercase tracking-widest leading-relaxed">R{"\u00e9"}cup{"\u00e9"}ration des sites...</p>
        </div>
      ) : form.availableSites.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center h-full py-20 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Search size={24} className="text-gray-200" />
          </div>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">Aucun site d{"\u00e9"}tect{"\u00e9"}<br/><span className="text-[10px] font-normal lowercase tracking-normal">Lancez la recherche via le pivot</span></p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {form.availableSites.map(s => (
            <button key={s} onClick={() => form.setSelectedSites(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={`group relative p-4 rounded-lg border transition-all text-left overflow-hidden ${form.selectedSites.includes(s) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-100' : 'bg-white border-gray-100 text-gray-700 hover:border-indigo-200 hover:shadow-sm'}`}>
              <span className="text-[12px] font-bold relative z-10 block truncate pr-6">{s}</span>
              <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${form.selectedSites.includes(s) ? 'bg-white border-white' : 'border-gray-100 group-hover:border-indigo-200'}`}>
                {form.selectedSites.includes(s) && <Check size={10} className="text-indigo-600 font-bold" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  </>
);

