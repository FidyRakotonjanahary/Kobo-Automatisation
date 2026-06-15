import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AxiosError, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import api from '../api/client';
import type {
  ExportRequest,
  ExportResult,
  GoogleStatus,
  PreviewRequest,
  PreviewResult,
} from '../types/export';
import { normalizeCsvEncoding, useExportSelection } from './useExportSelection';

type ExportSelectionState = ReturnType<typeof useExportSelection>;
type ApiErrorBody = { message?: string };

export const useExportActions = (selection: ExportSelectionState) => {
  const [result, setResult] = useState<ExportResult | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
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

  const handlePreview = async () => {
    if (!selection.selectedFormName || selection.selectedSheets.length === 0) {
      toast.error("Choisissez un onglet.");
      return;
    }
    setLoadingPreview(true);
    try {
      const accountForms = selection.buildAccountForms();
      const requestEncoding = normalizeCsvEncoding(selection.csvSeparator, selection.csvEncoding);
      const payload: PreviewRequest = {
        account_forms: accountForms,
        form_name: selection.selectedFormName,
        csv_separator: selection.csvSeparator,
        csv_encoding: requestEncoding as PreviewRequest['csv_encoding'],
        csv_quotechar: selection.csvQuotechar,
        selected_sheets: selection.selectedSheets,
      };
      const res = await api.post<PreviewResult>('/exports/preview', payload);
      setCsvPreview(res.data.preview);
    } catch {
      toast.error("Erreur aper\u00e7u.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRun = () => {
    if (selection.selectedAccountIds.length === 0 || !selection.selectedFormName) {
      toast.error("Config incompl\u00e8te.");
      return;
    }
    if (selection.selectedSheets.length === 0) {
      toast.error("S\u00e9lectionnez au moins un onglet.");
      return;
    }
    // En mode CSV, si plusieurs onglets sont présents, on prendra de toute façon le premier dans le backend.
    // On retire donc le blocage strict ici pour plus de souplesse.

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
    csvPreview,
    loadingPreview,
    exportMutation,
    handlePreview,
    handleRun,
    handleCancel,
    setDriveFolderId,
    setCsvPreview,
  };
};

