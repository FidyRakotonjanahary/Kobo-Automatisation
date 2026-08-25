import { useState, useMemo } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  FileSpreadsheet,
  Filter,
  Layers,
  ListFilter,
  RefreshCw,
  Search,
  Square,
  User,
} from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface SubmissionsSelectionPanelProps {
  form: UseExportFormReturn;
}

export const SubmissionsSelectionPanel = ({ form }: SubmissionsSelectionPanelProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBySelectedSites, setFilterBySelectedSites] = useState(true);

  // Filtrer les soumissions selon la recherche et les secteurs actuellement sélectionnés
  const filteredSubmissions = useMemo(() => {
    return form.availableSubmissions.filter(sub => {
      // 1. Filtrage par secteur/site sélectionné
      if (filterBySelectedSites && form.selectedSites.length > 0 && sub.site) {
        if (!form.selectedSites.includes(sub.site)) {
          return false;
        }
      }

      // 2. Filtrage textuel (recherche)
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (sub.label && sub.label.toLowerCase().includes(term)) ||
        (sub.site && sub.site.toLowerCase().includes(term)) ||
        (sub.submission_time && sub.submission_time.toLowerCase().includes(term)) ||
        (sub.id && sub.id.toLowerCase().includes(term))
      );
    });
  }, [form.availableSubmissions, form.selectedSites, filterBySelectedSites, searchTerm]);

  // Nombre de soumissions visibles sélectionnées
  const visibleSelectedCount = useMemo(() => {
    return filteredSubmissions.filter(s => form.selectedSubmissionIds.includes(s.id)).length;
  }, [filteredSubmissions, form.selectedSubmissionIds]);

  const isAllVisibleSelected = filteredSubmissions.length > 0 && visibleSelectedCount === filteredSubmissions.length;
  const isSomeVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < filteredSubmissions.length;

  const handleToggleAllVisible = () => {
    const visibleIds = filteredSubmissions.map(s => s.id);
    if (isAllVisibleSelected) {
      form.deselectSubmissions(visibleIds);
    } else {
      form.selectAllSubmissions(visibleIds);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── En-tête du panneau ── */}
      <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <ListFilter size={16} className="text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-gray-900">Soumissions individuelles</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {form.selectedSubmissionIds.length} / {form.availableSubmissions.length} sélectionnée(s)
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium tracking-tight">
              Cochez les lignes spécifiques à inclure dans l'export
            </p>
          </div>
        </div>

        {/* Boutons d'action globale */}
        <div className="flex items-center gap-2">
          {form.selectedSites.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterBySelectedSites(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                filterBySelectedSites
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
              title="Afficher uniquement les soumissions des secteurs cochés"
            >
              <Filter size={11} />
              {filterBySelectedSites ? 'Secteurs cochés uniquement' : 'Tous les secteurs'}
            </button>
          )}

          <button
            type="button"
            onClick={() => form.selectAllSubmissions()}
            className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={() => form.deselectSubmissions()}
            className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider"
          >
            Tout décocher
          </button>
        </div>
      </div>

      {/* ── Barre de recherche ── */}
      {form.availableSubmissions.length > 0 && (
        <div className="px-6 py-2.5 border-b border-gray-100 bg-white flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, répondant, date, secteur ou identifiant..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-[11px] rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-[10px] text-gray-400 hover:text-gray-600 font-semibold uppercase tracking-tight"
            >
              Effacer
            </button>
          )}
          <span className="text-[10px] text-gray-400 shrink-0 font-medium">
            {filteredSubmissions.length} ligne(s) affichée(s)
          </span>
        </div>
      )}

      {/* ── Corps du tableau / États ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {!form.selectedFormName ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 grayscale opacity-30">
            <Layers size={56} strokeWidth={1} className="mb-4 text-indigo-900" />
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-gray-900">En attente de formulaire</p>
            <p className="text-[11px] mt-1 text-gray-500 max-w-[280px]">
              Sélectionnez un formulaire Kobo pour afficher ses soumissions.
            </p>
          </div>
        ) : (form.loadingSites || form.loadingColumns || form.loadingStructure) ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center animate-pulse">
            <RefreshCw size={32} className="text-indigo-500 animate-spin mb-4" />
            <p className="text-[12px] font-bold text-indigo-600 uppercase tracking-widest leading-relaxed">
              Chargement des soumissions Kobo...
            </p>
          </div>
        ) : form.availableSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <FileSpreadsheet size={24} className="text-gray-300" />
            </div>
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">
              Aucune soumission détectée
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Vérifiez que le formulaire Kobo contient des données soumises.
            </p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <Search size={20} className="text-gray-300" />
            </div>
            <p className="text-[12px] font-bold text-gray-500">Aucun résultat</p>
            <p className="text-[10px] text-gray-400 mt-1">
              Aucune soumission ne correspond à votre filtre de recherche ou de secteur.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="bg-gray-50/80 sticky top-0 z-10 border-b border-gray-100 backdrop-blur-sm">
              <tr className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2.5 px-4 w-10">
                  <button
                    type="button"
                    onClick={handleToggleAllVisible}
                    className="flex items-center justify-center text-indigo-600 hover:text-indigo-800 transition-colors"
                    title={isAllVisibleSelected ? "Tout décocher" : "Tout cocher"}
                  >
                    {isAllVisibleSelected ? (
                      <CheckSquare size={15} />
                    ) : isSomeVisibleSelected ? (
                      <div className="w-3.5 h-3.5 bg-indigo-600 rounded flex items-center justify-center">
                        <div className="w-2 h-0.5 bg-white" />
                      </div>
                    ) : (
                      <Square size={15} className="text-gray-300 hover:text-gray-500" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-4">Date &amp; Heure</th>
                <th className="py-2.5 px-4">Secteur / Site</th>
                <th className="py-2.5 px-4">Répondant / Identifiant</th>
                <th className="py-2.5 px-4 text-right">Réf. Kobo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSubmissions.map((sub, idx) => {
                const isSelected = form.selectedSubmissionIds.includes(sub.id);
                return (
                  <tr
                    key={sub.id || idx}
                    onClick={() => form.toggleSubmission(sub.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/40 hover:bg-indigo-50/70 text-gray-900 font-medium'
                        : 'hover:bg-gray-50/60 text-gray-600 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* Case à cocher */}
                    <td className="py-2.5 px-4">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'border-gray-300 bg-white hover:border-indigo-400'
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </td>

                    {/* Date & Heure */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Calendar size={12} className="text-indigo-400 shrink-0" />
                        <span className="font-mono text-[10px]">
                          {sub.submission_time || 'Non renseignée'}
                        </span>
                      </div>
                    </td>

                    {/* Secteur / Site */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {sub.site ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          {sub.site}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300 italic">-</span>
                      )}
                    </td>

                    {/* Répondant / Identifiant */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5 max-w-[320px] truncate">
                        <User size={11} className="text-gray-400 shrink-0" />
                        <span className="truncate font-semibold text-gray-800" title={sub.label}>
                          {sub.label || 'Soumission standard'}
                        </span>
                      </div>
                    </td>

                    {/* Réf. Kobo */}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <span
                        className="font-mono text-[9px] text-gray-400 hover:text-indigo-600 transition-colors"
                        title={sub.id}
                      >
                        {sub.id.length > 12 ? `${sub.id.slice(0, 8)}...` : sub.id}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pied de page / Info ── */}
      {form.availableSubmissions.length > 0 && (
        <div className="px-6 py-2 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between text-[9px] text-gray-400">
          <span>
            {form.selectedSubmissionIds.length === 0
              ? '⚠️ Aucune soumission cochée : l’export exportera tout par défaut.'
              : `${form.selectedSubmissionIds.length} soumission(s) incluse(s) dans le fichier exporté.`}
          </span>
          <span className="font-mono">
            Total formulaire : {form.availableSubmissions.length}
          </span>
        </div>
      )}
    </div>
  );
};
