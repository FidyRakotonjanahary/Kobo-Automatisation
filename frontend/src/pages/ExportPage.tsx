import { useRef, useState } from 'react';
import { LayoutGrid, ListFilter, Settings2 } from 'lucide-react';
import { AccountSelector } from '../components/export/AccountSelector';
import { ColumnsSelectionPanel } from '../components/export/ColumnsSelectionPanel';
import { DestinationActions } from '../components/export/DestinationActions';
import { ExportConsole } from '../components/export/ExportConsole';
import { ExportHeader } from '../components/export/ExportHeader';
import { FormSheetSelector } from '../components/export/FormSheetSelector';
import { PivotFormatSelector } from '../components/export/PivotFormatSelector';
import { SitesSelectionPanel } from '../components/export/SitesSelectionPanel';
import { SubmissionsSelectionPanel } from '../components/export/SubmissionsSelectionPanel';
import { useAccounts } from '../hooks/useAccounts';
import { useExportForm } from '../hooks/useExportForm';

type ActiveTab = 'submissions' | 'sites' | 'columns';

const ExportPage = () => {
  const consoleRef = useRef<HTMLDivElement>(null);
  const { accounts } = useAccounts();
  const form = useExportForm();
  const [activeTab, setActiveTab] = useState<ActiveTab>('submissions');

  return (
    <div className="page-shell">
      <ExportHeader googleConnected={form.googleConnected} />

      {/* ── 4 Cartes de configuration ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <AccountSelector accounts={accounts} form={form} />
        <FormSheetSelector form={form} />
        <PivotFormatSelector form={form} />
        <DestinationActions form={form} />
      </div>

      {/* ── Panneau principal (Onglets + Console de sortie) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 pt-4">
        <div className="surface-panel overflow-hidden flex flex-col h-[700px]">
          {/* Barre d'onglets ergonomique */}
          <div className="px-6 pt-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-[12px] transition-all border-t-2 ${
                activeTab === 'submissions'
                  ? 'bg-white text-indigo-700 border-t-indigo-600 shadow-sm border-x border-x-gray-100 -mb-px'
                  : 'text-gray-500 hover:text-gray-700 border-t-transparent hover:bg-white/50'
              }`}
            >
              <ListFilter size={14} className={activeTab === 'submissions' ? 'text-indigo-600' : 'text-gray-400'} />
              <span>Soumissions &amp; Lignes</span>
              {form.availableSubmissions.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                    activeTab === 'submissions'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {form.selectedSubmissionIds.length}/{form.availableSubmissions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sites')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-[12px] transition-all border-t-2 ${
                activeTab === 'sites'
                  ? 'bg-white text-indigo-700 border-t-indigo-600 shadow-sm border-x border-x-gray-100 -mb-px'
                  : 'text-gray-500 hover:text-gray-700 border-t-transparent hover:bg-white/50'
              }`}
            >
              <LayoutGrid size={14} className={activeTab === 'sites' ? 'text-indigo-600' : 'text-gray-400'} />
              <span>Secteurs &amp; Sites</span>
              {form.availableSites.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                    activeTab === 'sites'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {form.selectedSites.length}/{form.availableSites.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('columns')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-[12px] transition-all border-t-2 ${
                activeTab === 'columns'
                  ? 'bg-white text-indigo-700 border-t-indigo-600 shadow-sm border-x border-x-gray-100 -mb-px'
                  : 'text-gray-500 hover:text-gray-700 border-t-transparent hover:bg-white/50'
              }`}
            >
              <Settings2 size={14} className={activeTab === 'columns' ? 'text-indigo-600' : 'text-gray-400'} />
              <span>Colonnes</span>
              {form.mainSheetColumns.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                    activeTab === 'columns'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {form.selectedMainColumnCount}/{form.mainSheetColumns.length}
                </span>
              )}
            </button>
          </div>

          {/* Contenu de l'onglet actif */}
          <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
            {activeTab === 'submissions' && <SubmissionsSelectionPanel form={form} />}
            {activeTab === 'sites' && <SitesSelectionPanel form={form} />}
            {activeTab === 'columns' && <ColumnsSelectionPanel form={form} />}
          </div>
        </div>

        {/* Console de sortie (téléchargement, Google Drive, logs) */}
        <ExportConsole consoleRef={consoleRef} form={form} />
      </div>

      <style>{`
        @keyframes indeterminate {
            0% { transform: translateX(-100%); width: 20%; }
            50% { width: 40%; }
            100% { transform: translateX(500%); width: 20%; }
        }
      `}</style>
    </div>
  );
};

export default ExportPage;
