import { useExportActions } from './useExportActions';
import { useExportSelection } from './useExportSelection';

export const useExportForm = () => {
  const selection = useExportSelection();
  const actions = useExportActions(selection);

  return {
    ...selection,
    ...actions,
  };
};

export type UseExportFormReturn = ReturnType<typeof useExportForm>;

