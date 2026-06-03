import { RefreshCw, Users } from 'lucide-react';
import type { UseExportFormReturn } from '../../hooks/useExportForm';
import type { KoboAccount } from '../../types';

interface AccountSelectorProps {
  accounts?: KoboAccount[];
  form: UseExportFormReturn;
}

export const AccountSelector = ({ accounts, form }: AccountSelectorProps) => (
  <div className="surface-panel p-4 space-y-3">
    <div className="section-label">
      <Users size={13} className="text-gray-400" />
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">1. S{"\u00e9"}lection des Comptes <span className="text-red-500">*</span></span>
    </div>
    <div className="border border-gray-200 rounded-lg bg-white overflow-y-auto h-[180px] px-1 py-1 space-y-0.5 custom-scrollbar">
      {accounts?.map(acc => (
        <label key={acc.id} className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${form.selectedAccountIds.includes(acc.id) ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'hover:bg-gray-50 text-gray-600'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={form.selectedAccountIds.includes(acc.id)} onChange={() => form.toggleAccount(acc.id)} />
            <span className="text-[12px] font-bold truncate">{acc.name}</span>
          </div>
          {form.loadingAccountIds.includes(acc.id) && <RefreshCw size={10} className="text-indigo-500 animate-spin shrink-0" />}
        </label>
      ))}
    </div>
  </div>
);

