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
  Tag,
} from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';

interface SubmissionsSelectionPanelProps {
  form: UseExportFormReturn;
}

// Fonction de parsing robuste pour trier par date decroissante
const parseSubmissionDate = (dateStr?: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  if (!trimmed) return 0;

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

  const parsed = Date.parse(trimmed);
  return isNaN(parsed) ? 0 : parsed;
};

export const SubmissionsSelectionPanel = ({ form }: SubmissionsSelectionPanelProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  const hasPivot = form.pivot !== '';

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

  const filteredSubmissions = useMemo(() => {
    return form.availableSubmissions.filter(sub => {
      if (hasPivot && form.availableSites.length > 0) {
        if (form.selectedSites.length === 0) return false;
        if (sub.site && !form.selectedSites.includes(sub.site)) return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (sub.site && sub.site.toLowerCase().includes(term)) ||
        (sub.submission_time && sub.submission_time.toLowerCase().includes(term)) ||
        (sub.id && sub.id.toLowerCase().includes(term))
      );
    });
  }, [form.availableSubmissions, form.selectedSites, form.availableSites, hasPivot, searchTerm]);

  const sortedSubmissions = useMemo(() => {
    return [...filteredSubmissions].sort((a, b) => {
      const timeA = parseSubmissionDate(a.submission_time);
      const timeB = parseSubmissionDate(b.submission_time);
      if (timeA !== timeB) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [filteredSubmissions]);

  const visibleSelectedCount = useMemo(() => {
    return sortedSubmissions.filter(s => form.selectedSubmissionIds.includes(s.id)).length;
  }, [sortedSubmissions, form.selectedSubmissionIds]);

  const isAllVisibleSelected = sortedSubmissions.length > 0 && visibleSelectedCount === sortedSubmissions.length;
  const isSomeVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < sortedSubmissions.length;

  const handleSelectAllVisible = () => form.selectAllSubmissions(sortedSubmissions.map(s => s.id));
  const handleDeselectAllVisible = () => form.deselectSubmissions(sortedSubmissions.map(s => s.id));
  const handleToggleAllVisible = () => {
    const ids = sortedSubmissions.map(s => s.id);
    if (isAllVisibleSelected) form.deselectSubmissions(ids);
    else form.selectAllSubmissions(ids);
  };

  const toggleSite = (site: string) => {
    form.setSelectedSites(prev =>
      prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site]
    );
  };

  const noSectorSelected = hasPivot && form.availableSites.length > 0 && form.selectedSites.length === 0;
  const noSearchResult = !noSectorSelected && sortedSubmissions.length === 0 && searchTerm.trim().length > 0;
  const exportCount = form.selectedSubmissionIds.length;
  const hasNoSectorWarning = hasPivot && form.availableSites.length > 0 && form.selectedSites.length === 0;

  return (
    <div className="flex flex-col h-full bg-white">

      {/* En-tete du panneau */}
      <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
            <ListFilter size={16} className="text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-bold text-gray-900">Soumissions &amp; Secteurs</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {visibleSelectedCount} / {sortedSubmissions.length} visible(s)
              </span>
              {form.availableSubmissions.length > 0 && sortedSubmissions.length !== form.availableSubmissions.length && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                  {form.availableSubmissions.length} total
                </span>
              )}
              {hasPivot && form.availableSites.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                  form.selectedSites.length === 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  {form.selectedSites.length}/{form.availableSites.length} secteur(s)
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-medium tracking-tight mt-0.5">
              {hasPivot
                ? "Filtrez par secteur et cochez les soumissions à inclure dans l'export"
                : "Cochez les soumissions spécifiques à inclure dans l'export"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSelectAllVisible}
            disabled={sortedSubmissions.length === 0}
            title={sortedSubmissions.length === 0 ? 'Aucune soumission visible' : `Tout cocher (${sortedSubmissions.length} visible(s))`}
            className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={handleDeselectAllVisible}
            disabled={sortedSubmissions.length === 0}
            title={sortedSubmissions.length === 0 ? 'Aucune soumission visible' : `Tout decocher (${sortedSubmissions.length} visible(s))`}
            className="btn-secondary-linear !h-7 !text-[10px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tout decocher
          </button>
        </div>
      </div>

      {/* Filtre par Secteurs / Sites (uniquement si pivot actif) */}
      {hasPivot && form.availableSites.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-100 bg-slate-50/70 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayoutGrid size={13} className="text-indigo-500" />
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">
                Filtrer par secteur
              </span>
              <span className="text-[10px] text-gray-400 font-medium">
                ({form.selectedSites.length}/{form.availableSites.length})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => form.setSelectedSites(form.availableSites)}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => form.setSelectedSites([])}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 transition-colors"
              >
                Aucun
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar pb-0.5">
            {form.availableSites.map(site => {
              const isSelected = form.selectedSites.includes(site);
              const count = sectorSubmissionCounts[site];
              return (
                <button
                  key={site}
                  type="button"
                  onClick={() => toggleSite(site)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700'
                  }`}
                >
                  {isSelected && <Check size={9} strokeWidth={3} />}
                  <span className="truncate max-w-[180px]" title={site}>{site}</span>
                  {count !== undefined && (
                    <span className={`text-[9px] px-1.5 rounded-full font-mono font-bold leading-4 ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barre de recherche rapide */}
      {form.availableSubmissions.length > 0 && (
        <div className="px-6 py-2.5 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={hasPivot ? 'Rechercher par date, secteur ou référence Kobo…' : 'Rechercher par date ou référence Kobo…'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-[11px] rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50 placeholder:text-gray-400"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-[10px] text-gray-400 hover:text-gray-700 font-semibold uppercase tracking-tight whitespace-nowrap transition-colors"
            >
              Effacer
            </button>
          )}
          <span className="text-[10px] text-gray-400 shrink-0 font-medium tabular-nums">
            {sortedSubmissions.length} ligne(s)
          </span>
        </div>
      )}

      {/* Corps du tableau / États */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {!form.selectedFormName ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 grayscale opacity-30">
            <Layers size={56} strokeWidth={1} className="mb-4 text-indigo-900" />
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-gray-900">En attente de formulaire</p>
            <p className="text-[11px] mt-1 text-gray-500 max-w-[280px]">
              Sélectionnez un formulaire Kobo pour afficher ses soumissions.
            </p>
          </div>
        ) : form.loadingSites || form.loadingColumns || form.loadingStructure ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <RefreshCw size={28} className="text-indigo-400 animate-spin mb-4" />
            <p className="text-[12px] font-bold text-indigo-500 uppercase tracking-widest">Chargement des soumissions…</p>
            <p className="text-[10px] text-gray-400 mt-1.5">Un instant, récupération des données Kobo</p>
          </div>
        ) : form.availableSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <FileSpreadsheet size={24} className="text-gray-300" />
            </div>
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">Aucune soumission détectée</p>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[260px] leading-relaxed">
              Vérifiez que le formulaire Kobo contient des données soumises.
            </p>
          </div>
        ) : noSectorSelected ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-4 ring-1 ring-amber-100">
              <Tag size={22} className="text-amber-400" />
            </div>
            <p className="text-[12px] font-bold text-gray-600">Aucun secteur sélectionné</p>
            <p className="text-[10px] text-gray-400 mt-1.5 max-w-[260px] leading-relaxed">
              Cochez au moins un secteur ci-dessus pour afficher les soumissions correspondantes.
            </p>
            <button
              type="button"
              onClick={() => form.setSelectedSites(form.availableSites)}
              className="mt-4 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors shadow-sm"
            >
              Sélectionner tous les secteurs
            </button>
          </div>
        ) : noSearchResult ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <Search size={20} className="text-gray-300" />
            </div>
            <p className="text-[12px] font-bold text-gray-500">Aucun résultat</p>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">
              Aucune soumission ne correspond à votre recherche.
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-3 text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold underline underline-offset-2 transition-colors"
            >
              Effacer la recherche
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="bg-gray-50/90 sticky top-0 z-10 border-b border-gray-200/80 backdrop-blur-sm">
              <tr className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2.5 pl-4 pr-2 w-9">
                  <button
                    type="button"
                    onClick={handleToggleAllVisible}
                    className="flex items-center justify-center text-indigo-600 hover:text-indigo-800 transition-colors"
                    title={isAllVisibleSelected ? 'Tout décocher (visible)' : 'Tout cocher (visible)'}
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
                <th className="py-2.5 px-3">Date &amp; Heure</th>
                {hasPivot && <th className="py-2.5 px-3">Secteur / Site</th>}
                <th className="py-2.5 px-3 text-right">Réf. Kobo</th>
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
                        ? 'bg-indigo-50/50 hover:bg-indigo-50/80 text-gray-900'
                        : 'hover:bg-gray-50/70 text-gray-500'
                    }`}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                        isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'border-gray-300 bg-white hover:border-indigo-400'
                      }`}>
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-indigo-400 shrink-0" />
                        <span className={`font-mono text-[11px] ${isSelected ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                          {sub.submission_time || '-'}
                        </span>
                      </div>
                    </td>
                    {hasPivot && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {sub.site ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                            <Tag size={8} className="shrink-0" />
                            {sub.site}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300 italic">-</span>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <span className="font-mono text-[10px] text-gray-400 hover:text-indigo-600 transition-colors" title={sub.id}>
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

      {/* Pied de page contextuel coloré */}
      {form.availableSubmissions.length > 0 && (
        <div className={`px-6 py-2 border-t flex items-center justify-between text-[10px] shrink-0 transition-colors ${
          hasNoSectorWarning
            ? 'bg-amber-50/80 text-amber-700 border-amber-100'
            : exportCount === 0
            ? 'bg-orange-50/60 text-orange-600 border-orange-100'
            : 'bg-gray-50/50 text-gray-500 border-gray-100'
        }`}>
          <span>
            {hasNoSectorWarning
              ? '⚠️ Aucun secteur sélectionné — cochez au moins un secteur pour inclure des soumissions.'
              : exportCount === 0
              ? "⚠️ Aucune soumission cochée — l'export prendra toutes les soumissions par défaut."
              : (
                <>
                  <span className="text-emerald-600 font-bold mr-1">✓</span>
                  <span className="font-bold text-gray-700">{exportCount}</span>
                  {' soumission(s) incluse(s) dans l\'export.'}
                </>
              )
            }
          </span>
          <span className="font-mono text-gray-400 shrink-0 tabular-nums ml-4">
            Total : {form.availableSubmissions.length}
          </span>
        </div>
      )}
    </div>
  );
};
