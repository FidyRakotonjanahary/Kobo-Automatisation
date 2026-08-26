import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import type { SessionExportItem } from '../types/export';

export const useExportHistory = (limit: number = 50) => {
  const query = useQuery<SessionExportItem[]>({
    queryKey: ['export-history', limit],
    queryFn: () =>
      api.get<any[]>('/exports/history', { params: { limit } }).then(res =>
        res.data.map(item => ({
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
        }))
      ),
  });

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

