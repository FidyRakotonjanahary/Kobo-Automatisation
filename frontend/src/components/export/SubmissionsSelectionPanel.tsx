import { useState, useMemo } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  FileSpreadsheet,
  Layers,
  LayoutGrid,
  ListFilter,
  RefreshCw,
  Search,
  Square,
} from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface SubmissionsSelectionPanelProps {
  form: UseExportFormReturn;
}

// Fonction de parsing robuste pour trier par date décroissante
const parseSubmissionDate = (dateStr?: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  if (!trimmed) return 0;

  // Format français usuel : JJ/MM/AAAA HH:MM ou JJ/MM/AAAA
  const ddmmyyyyMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const hours = ddmmyyyyMatch[4] ? parseInt(ddmmyyyyMatch[4], 10) : 0;
    const minutes = ddmmyyyyMatch[5] ? parseInt(ddmmyyyyMatch[5], 10) : 0;
    const seconds = ddmmyyyyMatch[6] ? parseInt(ddmmyyyyMatch[6], 10) : 0;
    return new Date(year, month, day, hours, minutes, seconds).getTime();
  }

  // Fallback format standard ISO ou date convertible
  const parsed = Date.parse(trimmed);
  return isNaN(parsed) ? 0 : parsed;
};

export const SubmissionsSelectionPanel = ({ form }: SubmissionsSelectionPanelProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Indique si le pivot géographique est actif (une colonne de pivot est sélectionnée)
  const hasPivot = form.pivot !== '';

  // Nombre de soumissions par secteur
  const sectorSubmissionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const site of form.availableSites) {
      counts[site] = 0;
    }
    for (const sub of form.availableSubmissions) {
      if (sub.site && counts[sub.site] !== undefined) {
        counts[sub.site] = (counts[sub.site] || 0) + 1;
      }
    }
    return counts;
  }, [form.availableSites, form.availableSubmissions]);

  // Filtrer les soumissions selon la recherche et les secteurs actuellement sélectionnés
  const filteredSubmissions = useMemo(() => {
    return form.availableSubmissions.filter(sub => {
      // 1. Filtrage par secteur/site — uniquement si un pivot est actif
      if (hasPivot && form.availableSites.length > 0) {
        // Si aucun secteur n'est sélectionné, on n'affiche rien
        if (form.selectedSites.length === 0) return false;
        // Si la soumission a un site, on filtre par secteurs sélectionnés
        if (sub.site && !form.selectedSites.includes(sub.site)) return false;
      }

      // 2. Filtrage textuel (recherche)
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (sub.site && sub.site.toLowerCase().includes(term)) ||
        (sub.submission_time && sub.submission_time.toLowerCase().includes(term)) ||
        (sub.id && sub.id.toLowerCase().includes(term))
      );
    });
  }, [form.availableSubmissions, form.selectedSites, form.availableSites, hasPivot, searchTerm]);

  // 1. Tri par date décroissante (de la plus récente à la plus ancienne)
  const sortedSubmissions = useMemo(() => {
    return [...filteredSubmissions].sort((a, b) => {
      const timeA = parseSubmissionDate(a.submission_time);
      const timeB = parseSubmissionDate(b.submission_time);
      if (timeA !== timeB) {
        return timeB - timeA; // Plus récente en premier
      }
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [filteredSubmissions]);

  // Nombre de soumissions visibles sélectionnées
  const visibleSelectedCount = useMemo(() => {
    return sortedSubmissions.filter(s => form.selectedSubmissionIds.includes(s.id)).length;
  }, [sortedSubmissions, form.selectedSubmissionIds]);

  const isAllVisibleSelected =
    sortedSubmissions.length > 0 && visibleSelectedCount === sortedSubmissions.length;
  const isSomeVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < sortedSubmissions.length;

  const handleToggleAllVisible = () => {
    const visibleIds = sortedSubmissions.map(s => s.id);
    if (isAllVisibleSelected) {
      form.deselectSubmissions(visibleIds);
    } else {
      form.selectAllSubmissions(visibleIds);
    }
  };

  const toggleSite = (site: string) => {
    form.setSelectedSites(prev =>
      prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site]
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── En-tête du panneau unifié ── */}
      <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <ListFilter size={16} className="text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-bold text-gray-900">Soumissions &amp; Secteurs</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {form.selectedSubmissionIds.length} / {form.availableSubmissions.length} soumission(s)
              </span>
              {hasPivot && form.availableSites.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {form.selectedSites.length} / {form.availableSites.length} secteur(s)
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-medium tracking-tight">
              Filtrez par secteur et cochez les soumissions spécifiques à inclure dans l'export
            </p>
          </div>
        </div>

        {/* Boutons d'action globale pour les soumissions */}
        <div className="flex items-center gap-2">
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

      {/* ── 3. Section Filtre par Secteurs / Sites (uniquement si pivot actif) ── */}
      {hasPivot && form.availableSites.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-100 bg-slate-50/70 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayoutGrid size={13} className="text-indigo-600" />
              <span className="text-[11px] font-bold text-gray-800 uppercase tracking-tight">
                Secteurs / Sites ({form.selectedSites.length}/{form.availableSites.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => form.setSelectedSites(form.availableSites)}
                className="px-2 py-0.5 rounded font-medium bg-white hover:bg-gray-100 text-indigo-600 border border-gray-200 transition-colors"
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => form.setSelectedSites([])}
                className="px-2 py-0.5 rounded font-medium bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 transition-colors"
              >
                Aucun
              </button>
            </div>
          </div>

          {/* Boutons de secteurs cliquables */}
          <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto custom-scrollbar p-0.5">
            {form.availableSites.map(site => {
              const isSelected = form.selectedSites.includes(site);
              const count = sectorSubmissionCounts[site];

              return (
                <button
                  key={site}
                  type="button"
                  onClick={() => toggleSite(site)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-semibold'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-white/20 text-white' : 'border border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} />}
                  </div>
                  <span className="truncate max-w-[200px]" title={site}>
                    {site}
                  </span>
                  {count !== undefined && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* ── Barre de recherche rapide ── */}
      {form.availableSubmissions.length > 0 && (
        <div className="px-6 py-2.5 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filtrer les soumissions par date, secteur ou référence Kobo..."
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
            {sortedSubmissions.length} ligne(s) affichée(s)
          </span>
        </div>
      )}

      {/* ── Corps du tableau / États ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {!form.selectedFormName ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 grayscale opacity-30">
            <Layers size={56} strokeWidth={1} className="mb-4 text-indigo-900" />
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-gray-900">
              En attente de formulaire
            </p>
            <p className="text-[11px] mt-1 text-gray-500 max-w-[280px]">
              Sélectionnez un formulaire Kobo pour afficher ses soumissions et secteurs.
            </p>
          </div>
        ) : form.loadingSites || form.loadingColumns || form.loadingStructure ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center animate-pulse">
            <RefreshCw size={32} className="text-indigo-500 animate-spin mb-4" />
            <p className="text-[12px] font-bold text-indigo-600 uppercase tracking-widest leading-relaxed">
              Chargement des soumissions &amp; secteurs...
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
        ) : sortedSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <Search size={20} className="text-gray-300" />
            </div>
            <p className="text-[12px] font-bold text-gray-500">Aucun résultat</p>
            <p className="text-[10px] text-gray-400 mt-1">
              Aucune soumission ne correspond aux filtres de recherche ou de secteur actuels.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="bg-gray-50/90 sticky top-0 z-10 border-b border-gray-200/80 backdrop-blur-sm">
              <tr className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                {/* 1. Case à cocher globale */}
                <th className="py-2.5 px-4 w-10">
                  <button
                    type="button"
                    onClick={handleToggleAllVisible}
                    className="flex items-center justify-center text-indigo-600 hover:text-indigo-800 transition-colors"
                    title={isAllVisibleSelected ? 'Tout décocher le visible' : 'Tout cocher le visible'}
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

                {/* 2. Date & Heure */}
                <th className="py-2.5 px-4">Date &amp; Heure</th>

                {/* 3. Secteur / Site — visible uniquement quand un pivot est sélectionné */}
                {hasPivot && <th className="py-2.5 px-4">Secteur / Site</th>}

                {/* 4. Réf. Kobo (colonne Répondant retirée) */}
                <th className="py-2.5 px-4 text-right">Réf. Kobo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSubmissions.map((sub, idx) => {
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

                    {/* Date & Heure (Triée par défaut de la plus récente à la plus ancienne) */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Calendar size={12} className="text-indigo-500 shrink-0" />
                        <span className="font-mono text-[11px] font-medium">
                          {sub.submission_time || 'Non renseignée'}
                        </span>
                      </div>
                    </td>

                    {/* Secteur / Site — visible uniquement quand un pivot est sélectionné */}
                    {hasPivot && (
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {sub.site ? (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                            {sub.site}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300 italic">-</span>
                        )}
                      </td>
                    )}

                    {/* Réf. Kobo */}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <span
                        className="font-mono text-[10px] text-gray-400 hover:text-indigo-600 transition-colors"
                        title={sub.id}
                      >
                        {sub.id.length > 16 ? `${sub.id.slice(0, 12)}...` : sub.id}
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
        <div className="px-6 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-[10px] text-gray-500 shrink-0">
          <span>
            {form.selectedSubmissionIds.length === 0
              ? '⚠️ Aucune soumission cochée : l’export prendra toutes les soumissions par défaut.'
              : `${form.selectedSubmissionIds.length} soumission(s) incluse(s) dans le fichier exporté.`}
          </span>
          <span className="font-mono text-gray-400">
            Total : {form.availableSubmissions.length}
          </span>
        </div>
      )}
    </div>
  );
};
