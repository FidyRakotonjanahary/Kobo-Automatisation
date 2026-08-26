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
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // 1. Récupération de l'historique persistant depuis la base de données Neon
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get<any[]>('/exports/history');
      const mapped: SessionExportItem[] = res.data.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        formName: item.form_name,
        format: item.format,
        status: item.status,
        message: item.message || '',
        files: item.files || [],
        driveSuccess: item.drive_success,
        driveErrors: item.drive_errors,
        errorMessage: item.status === 'error' ? item.message : undefined,
        createdAt: item.created_at,
      }));
      setExportHistory(mapped);
    } catch (err) {
      console.warn('Impossible de charger l’historique des exports depuis la base :', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
  }, []);

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

      // Recharger l'historique depuis la base Neon pour garantir la synchronisation parfaite
      void fetchHistory();
    },
    onError: (err, variables) => {
      const errMsg = err.response?.data?.message || "Erreur pendant l'export.";
      toast.error(errMsg);
      setCurrentTaskId(null);

      // Recharger l'historique depuis la base Neon (l'erreur y a été enregistrée)
      void fetchHistory();
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

  const clearExportHistory = async () => {
    try {
      await api.delete('/exports/history');
      setExportHistory([]);
      setResult(null);
      toast.success("Historique des exports effacé.");
    } catch {
      setExportHistory([]);
      setResult(null);
    }
  };

  return {
    result,
    exportHistory,
    loadingHistory,
    googleConnected,
    driveFolderId,
    exportMutation,
    handleRun,
    handleCancel,
    clearExportHistory,
    refetchHistory: fetchHistory,
    setDriveFolderId,
  };
};
