import { useRef } from 'react';
import { AccountSelector } from '../components/export/AccountSelector';
import { ColumnsSelectionPanel } from '../components/export/ColumnsSelectionPanel';
import { CsvPreviewPanel } from '../components/export/CsvPreviewPanel';
import { DestinationActions } from '../components/export/DestinationActions';
import { ExportConsole } from '../components/export/ExportConsole';
import { ExportHeader } from '../components/export/ExportHeader';
import { FormSheetSelector } from '../components/export/FormSheetSelector';
import { PivotFormatSelector } from '../components/export/PivotFormatSelector';
import { SitesSelectionPanel } from '../components/export/SitesSelectionPanel';
import { useAccounts } from '../hooks/useAccounts';
import { useExportForm } from '../hooks/useExportForm';

const ExportPage = () => {
  const consoleRef = useRef<HTMLDivElement>(null);
  const { accounts } = useAccounts();
  const form = useExportForm();

  return (
    <div className="page-shell">
      <ExportHeader googleConnected={form.googleConnected} />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <AccountSelector accounts={accounts} form={form} />
        <FormSheetSelector form={form} />
        <PivotFormatSelector form={form} />
        <DestinationActions form={form} />
      </div>

      <CsvPreviewPanel form={form} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 pt-4">
        <div className="surface-panel overflow-hidden flex flex-col h-[700px]">
          <SitesSelectionPanel form={form} />
        </div>
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

