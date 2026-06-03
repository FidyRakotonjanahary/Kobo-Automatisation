import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import type { KoboAccount } from '../types';

export const useAccounts = () => {
  const query = useQuery<KoboAccount[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get<KoboAccount[]>('/kobo/accounts').then(res => res.data),
  });

  return {
    accounts: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
};

