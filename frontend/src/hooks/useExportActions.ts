import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AxiosError, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import api from '../api/client';
import type {
  ExportRequest,
  ExportResult,
  GoogleStatus,
} from '../types/export';
import { normalizeCsvEncoding, useExportSelection } from './useExportSelection';

type ExportSelectionState = ReturnType<typeof useExportSelection>;
type ApiErrorBody = { message?: string };

export const useExportActions = (selection: ExportSelectionState) => {
  const [result, setResult] = useState<ExportResult | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const exportMutation = useMutation<AxiosResponse<ExportResult>, AxiosError<ApiErrorBody>, ExportRequest>({
    mutationFn: (data) => api.post<ExportResult>('/exports/run', data),
    onSuccess: (res) => {
      setResult(res.data);
      if (res.data.message.includes('annul')) {
        toast.error('Exportation interrompue.');
      } else {
        toast.success('Export terminé avec succès');
      }
      setCurrentTaskId(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Erreur pendant l'export.");
      setCurrentTaskId(null);
    },
  });

  useEffect(() => {
    api.get<GoogleStatus>('/google/status')
      .then(res => setGoogleConnected(res.data.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  const handleRun = () => {
    if (selection.selectedAccountIds.length === 0 || !selection.selectedFormName) {
      toast.error("Config incomplète.");
      return;
    }
    if (selection.selectedSheets.length === 0) {
      toast.error("Sélectionnez au moins un onglet.");
      return;
    }

    setResult(null);
    const accountForms = selection.buildAccountForms();
    const requestEncoding = normalizeCsvEncoding(selection.csvSeparator, selection.csvEncoding);

    const taskId = `task_${Date.now()}`;
    setCurrentTaskId(taskId);

    exportMutation.mutate({
      account_forms: accountForms,
      form_name: selection.selectedFormName,
      pivot_column: selection.pivot || undefined,
      selected_columns: selection.selectedColumnsForExport,
      selected_sheets: selection.selectedSheets,
      filter_sites: selection.pivot ? selection.selectedSites : undefined,
      drive_folder_id: driveFolderId.trim() || undefined,
      export_format: selection.exportFormat,
      csv_separator: selection.csvSeparator,
      csv_encoding: requestEncoding as ExportRequest['csv_encoding'],
      csv_quotechar: selection.csvQuotechar,
      task_id: taskId,
    });
  };

  const handleCancel = async () => {
    if (!currentTaskId) return;
    try {
      await api.post(`/exports/cancel`, null, { params: { task_id: currentTaskId } });
      toast("Demande d'arrêt envoyée...", { icon: '🛑' });
    } catch {
      toast.error("Impossible d'arrêter l'export.");
    }
  };

  return {
    result,
    googleConnected,
    driveFolderId,
    exportMutation,
    handleRun,
    handleCancel,
    setDriveFolderId,
  };
};
