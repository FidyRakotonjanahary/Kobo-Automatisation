import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import type { KoboForm } from '../types';
import type {
  AccountFormPair,
  AccountFormsMap,
  CsvEncoding,
  CsvPrefs,
  CsvSeparator,
  ExportFormat,
  FormStructure,
  PreviewSitesResult,
} from '../types/export';

const REQUIRED_MAIN_COLUMNS = ['_id', '_index', '_uuid', '_submission_time', '_parent_index'];

export const normalizeCsvEncoding = (separator: string, encoding: string) => {
  // On force toujours UTF-8 avec BOM pour une compatibilité Excel maximale
  return 'utf-8-sig';
};

export const useExportSelection = () => {
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [accountFormsMap, setAccountFormsMap] = useState<AccountFormsMap>({});
  const [commonForms, setCommonForms] = useState<KoboForm[]>([]);
  const [selectedFormName, setSelectedFormName] = useState<string>('');
  const [formStructure, setFormStructure] = useState<FormStructure | null>(null);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [mainExportColumns, setMainExportColumns] = useState<string[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [availableSites, setAvailableSites] = useState<string[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [pivot, setPivot] = useState('');
  const [loadingAccountIds, setLoadingAccountIds] = useState<number[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [csvSeparator] = useState<CsvSeparator>(';');
  const [csvEncoding] = useState<CsvEncoding>('utf-8-sig');
  const [csvQuotechar] = useState('"');

  const mainSheet = formStructure?.sheets[0];
  const fallbackMainSheetColumns = mainSheet?.columns ?? [];
  const mainSheetColumns = mainExportColumns.length > 0 ? mainExportColumns : fallbackMainSheetColumns;
  const requiredMainColumns = Array.from(new Set([...REQUIRED_MAIN_COLUMNS, ...(pivot ? [pivot] : [])]));
  const requiredMainColumnSet = new Set(requiredMainColumns);
  const selectedColumnsForExport = Array.from(new Set([...selectedColumns, ...requiredMainColumns]));
  const selectedMainColumnCount = mainSheetColumns.filter(c => selectedColumnsForExport.includes(c)).length;

  const isRequiredMainColumn = (column: string) => requiredMainColumnSet.has(column);

  const toggleMainColumn = (column: string) => {
    if (isRequiredMainColumn(column)) return;
    setSelectedColumns(prev => prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]);
  };

  const selectAllMainColumns = () => {
    setSelectedColumns(prev => Array.from(new Set([
      ...prev.filter(c => !mainSheetColumns.includes(c)),
      ...mainSheetColumns,
      ...requiredMainColumns,
    ])));
  };

  const deselectOptionalMainColumns = () => {
    setSelectedColumns(prev => Array.from(new Set([
      ...prev.filter(c => !mainSheetColumns.includes(c)),
      ...requiredMainColumns,
    ])));
  };

  const buildAccountForms = (formName = selectedFormName): AccountFormPair[] => selectedAccountIds.map(accId => {
    const forms = accountFormsMap[accId] ?? [];
    const match = forms.find(f => f.name.trim().toLowerCase() === formName.toLowerCase());
    return { account_id: accId, form_uid: match?.uid ?? '' };
  }).filter(af => af.form_uid !== '');

  const applyMainExportColumns = (columns: string[], resetSelection = false) => {
    if (columns.length === 0) return;
    const columnSet = new Set(columns);
    setMainExportColumns(columns);
    setSelectedColumns(prev => {
      if (resetSelection || prev.length === 0) return columns;
      const keptColumns = prev.filter(column => columnSet.has(column));
      const fixedColumns = requiredMainColumns.filter(column => columnSet.has(column));
      const next = Array.from(new Set([...keptColumns, ...fixedColumns]));
      return next.length > 0 ? next : columns;
    });
  };

  const fetchActualColumns = async (formName: string, resetSelection = false) => {
    if (!formName || selectedAccountIds.length === 0) return;
    const accountForms = buildAccountForms(formName);
    if (accountForms.length === 0) return;

    setLoadingColumns(true);
    try {
      const res = await api.post<PreviewSitesResult>('/exports/preview-sites', {
        account_forms: accountForms,
        form_name: formName,
      });
      const columns = Array.isArray(res.data.columns) ? res.data.columns.map(String) : [];
      applyMainExportColumns(columns, resetSelection);
    } catch {
      toast.error("Erreur chargement colonnes export.");
    } finally {
      setLoadingColumns(false);
    }
  };

  const fetchStructure = async (formName: string) => {
    setSelectedFormName(formName);
    setFormStructure(null);
    setMainExportColumns([]);
    setAvailableSites([]);
    setPivot('');
    setSelectedSheets([]);
    setSelectedColumns([]);

    if (!formName || selectedAccountIds.length === 0) return;

    const firstAccId = selectedAccountIds[0];
    const forms = accountFormsMap[firstAccId] ?? [];
    const match = forms.find(f => f.name.trim().toLowerCase() === formName.toLowerCase());
    if (!match) return;

    setLoadingStructure(true);
    try {
      const res = await api.get<FormStructure>(`/kobo/structure/${firstAccId}/${match.uid}`);
      setFormStructure(res.data);

      if (res.data.sheets.length > 0) {
        const allSheetNames = res.data.sheets.map(s => s.name);
        setSelectedSheets(allSheetNames);
        setSelectedColumns(res.data.sheets[0].columns);
        void fetchActualColumns(formName, true);
      }
    } catch {
      toast.error("Erreur de chargement de la structure.");
    } finally {
      setLoadingStructure(false);
    }
  };

  const handleSheetToggle = (sheetName: string) => {
    if (exportFormat === 'csv') {
      setSelectedSheets([sheetName]);
    } else {
      setSelectedSheets(prev => prev.includes(sheetName) ? prev.filter(s => s !== sheetName) : [...prev, sheetName]);
    }
  };

  const fetchSites = async () => {
    if (loadingSites || !selectedFormName || !pivot) return;
    setLoadingSites(true);
    try {
      const accountForms = buildAccountForms();

      const res = await api.post<PreviewSitesResult>('/exports/preview-sites', {
        account_forms: accountForms,
        form_name: selectedFormName,
        pivot_column: pivot,
      });
      const columns = Array.isArray(res.data.columns) ? res.data.columns.map(String) : [];
      applyMainExportColumns(columns);
      setAvailableSites(res.data.sites || []);
      setSelectedSites(res.data.sites || []);
    } catch {
      toast.error("Erreur d\u00e9tection sites.");
    } finally {
      setLoadingSites(false);
    }
  };

  const toggleAccount = (id: number) => {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const recompute = (newIds: number[], newMap: AccountFormsMap) => {
    if (newIds.length === 0) {
      setCommonForms([]);
      setSelectedFormName('');
      return;
    }

    const lists = newIds.map(id => newMap[id] ?? []);
    if (lists.some(l => l.length === 0)) {
      setCommonForms([]);
      return;
    }

    const normalize = (s: string) => s.trim().toLowerCase();
    let commonNames = new Set(lists[0].map(f => normalize(f.name)));

    for (let i = 1; i < lists.length; i++) {
      const currentNames = new Set(lists[i].map(f => normalize(f.name)));
      commonNames = new Set([...commonNames].filter(n => currentNames.has(n)));
    }

    const filtered = lists[0].filter(f => commonNames.has(normalize(f.name)));
    setCommonForms(filtered);

    if (filtered.length === 0 && newIds.length > 1) {
      toast.error("Aucun formulaire commun trouv\u00e9 entre ces comptes.", { id: 'no-common' });
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('kobo_csv_prefs');
    if (saved) {
      try {
        const prefs = JSON.parse(saved) as CsvPrefs;
        const savedSeparator = prefs.sep || ';';
        const savedEncoding = normalizeCsvEncoding(savedSeparator, prefs.enc || 'utf-8-sig') as CsvEncoding;
        if (prefs.format) setExportFormat(prefs.format);
      } catch {
        localStorage.removeItem('kobo_csv_prefs');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('kobo_csv_prefs', JSON.stringify({
      format: exportFormat,
    }));

    // Si on passe en mode CSV, on ne garde qu'un seul onglet (le premier sélectionné ou le main)
    if (exportFormat === 'csv' && selectedSheets.length > 1) {
      if (formStructure && formStructure.sheets.length > 0) {
        // On cherche si l'onglet principal (index 0) est dans la sélection
        const mainSheetName = formStructure.sheets[0].name;
        if (selectedSheets.includes(mainSheetName)) {
          setSelectedSheets([mainSheetName]);
        } else {
          setSelectedSheets([selectedSheets[0]]);
        }
      } else {
        setSelectedSheets([selectedSheets[0]]);
      }
    }
  }, [exportFormat, selectedSheets, formStructure]);

  useEffect(() => {
    if (pivot && selectedFormName && selectedAccountIds.length > 0) {
      void fetchSites();
    }
    if (pivot) {
      setSelectedColumns(prev => prev.includes(pivot) ? prev : [...prev, pivot]);
    }
  }, [pivot]);

  useEffect(() => {
    const missingIds = selectedAccountIds.filter(id => !accountFormsMap[id] && !loadingAccountIds.includes(id));

    if (missingIds.length > 0) {
      const fetchMissing = async () => {
        const id = missingIds[0];
        setLoadingAccountIds(prev => [...prev, id]);
        try {
          const res = await api.get<KoboForm[]>(`/kobo/forms/${id}`);
          setAccountFormsMap(prev => ({ ...prev, [id]: res.data }));
        } catch {
          toast.error("Erreur chargement compte.");
        } finally {
          setLoadingAccountIds(prev => prev.filter(x => x !== id));
        }
      };
      void fetchMissing();
    }
  }, [selectedAccountIds, accountFormsMap, loadingAccountIds]);

  useEffect(() => {
    recompute(selectedAccountIds, accountFormsMap);
  }, [selectedAccountIds, accountFormsMap]);

  return {
    selectedAccountIds,
    accountFormsMap,
    commonForms,
    selectedFormName,
    formStructure,
    loadingStructure,
    mainExportColumns,
    loadingColumns,
    availableSites,
    selectedSites,
    selectedSheets,
    selectedColumns,
    loadingSites,
    pivot,
    loadingAccountIds,
    exportFormat,
    csvSeparator,
    csvEncoding,
    csvQuotechar,
    mainSheet,
    mainSheetColumns,
    requiredMainColumns,
    selectedColumnsForExport,
    selectedMainColumnCount,
    isRequiredMainColumn,
    toggleMainColumn,
    selectAllMainColumns,
    deselectOptionalMainColumns,
    buildAccountForms,
    applyMainExportColumns,
    fetchActualColumns,
    fetchStructure,
    handleSheetToggle,
    fetchSites,
    toggleAccount,
    recompute,
    setSelectedSites,
    setSelectedColumns,
    setPivot,
    setExportFormat,
  };
};

