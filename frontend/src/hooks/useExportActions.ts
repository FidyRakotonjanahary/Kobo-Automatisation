import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AxiosError, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import api from '../api/client';
import type {
  ExportRequest,
  ExportResult,
  GoogleStatus,
  SessionExportItem,
} from '../types/export';
import { normalizeCsvEncoding, useExportSelection } from './useExportSelection';

type ExportSelectionState = ReturnType<typeof useExportSelection>;
type ApiErrorBody = { message?: string };

export const useExportActions = (selection: ExportSelectionState) => {
  const [result, setResult] = useState<ExportResult | null>(null);
  const [exportHistory, setExportHistory] = useState<SessionExportItem[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const exportMutation = useMutation<AxiosResponse<ExportResult>, AxiosError<ApiErrorBody>, ExportRequest>({
    mutationFn: (data) => api.post<ExportResult>('/exports/run', data),
    onSuccess: (res, variables) => {
      setResult(res.data);
      const isCancelled = res.data.message?.toLowerCase().includes('annul') ?? false;
      if (isCancelled) {
        toast.error('Exportation interrompue.');
      } else {
        toast.success('Export terminé avec succès');
      }
      setCurrentTaskId(null);

      const timeStr = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const newEntry: SessionExportItem = {
        id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: timeStr,
        formName: variables.form_name,
        format: variables.export_format,
        status: isCancelled ? 'cancelled' : 'success',
        message: res.data.message,
        files: res.data.files || [],
        directory: res.data.directory,
        driveSuccess: res.data.drive_success,
        driveErrors: res.data.drive_errors,
      };

      setExportHistory(prev => [newEntry, ...prev]);
    },
    onError: (err, variables) => {
      const errMsg = err.response?.data?.message || "Erreur pendant l'export.";
      toast.error(errMsg);
      setCurrentTaskId(null);

      const timeStr = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const newEntry: SessionExportItem = {
        id: `exp_err_${Date.now()}`,
        timestamp: timeStr,
        formName: variables.form_name,
        format: variables.export_format,
        status: 'error',
        message: errMsg,
        files: [],
        errorMessage: errMsg,
      };

      setExportHistory(prev => [newEntry, ...prev]);
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
      filter_submission_ids: selection.selectedSubmissionIds.length > 0 ? selection.selectedSubmissionIds : undefined,
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

  const clearExportHistory = () => {
    setExportHistory([]);
    setResult(null);
  };

  return {
    result,
    exportHistory,
    googleConnected,
    driveFolderId,
    exportMutation,
    handleRun,
    handleCancel,
    clearExportHistory,
    setDriveFolderId,
  };
};
