import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export interface ExportHistoryItem {
  id: number;
  account_id: number | null;
  form_name: string;
  pivot_field: string;
  output_path: string;
  created_at: string;
}

export const useExportHistory = (accountId?: number) => {
  const query = useQuery<ExportHistoryItem[]>({
    queryKey: ['export-history', accountId],
    enabled: false,
    queryFn: () => api.get<ExportHistoryItem[]>(`/exports/history/${accountId}`).then(res => res.data),
  });

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

