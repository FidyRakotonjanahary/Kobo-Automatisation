import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/client';
import toast from 'react-hot-toast';
import { KoboAccount, KoboForm } from '../types';
import { 
  Send, CheckCircle, FolderOpen, Users, 
  RefreshCw, Link, ChevronRight, Database, LayoutGrid,
  Search, Activity, Settings2, Eye, AlertCircle, Check, 
  Layers
} from 'lucide-react';

type SheetStructure = {
    name: string;
    columns: string[];
};

type FormStructure = {
    sheets: SheetStructure[];
};

type AccountFormsMap = Record<number, KoboForm[]>;

const REQUIRED_MAIN_COLUMNS = ['_id', '_index', '_uuid', '_submission_time', '_parent_index'];

const normalizeCsvEncoding = (separator: string, encoding: string) => {
  const normalized = (encoding || 'utf-8-sig').toLowerCase().replace('_', '-');
  if (separator === ';' && normalized === 'utf-8') return 'utf-8-sig';
  return encoding || 'utf-8-sig';
};

const ExportPage = () => {
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
  const [result, setResult] = useState<any>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  const consoleRef = useRef<HTMLDivElement>(null);

  // CSV Settings
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [csvSeparator, setCsvSeparator] = useState(';');
  const [csvEncoding, setCsvEncoding] = useState('utf-8-sig');
  const [csvQuotechar, setCsvQuotechar] = useState('"');
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
      ...requiredMainColumns
    ])));
  };

  const deselectOptionalMainColumns = () => {
    setSelectedColumns(prev => Array.from(new Set([
      ...prev.filter(c => !mainSheetColumns.includes(c)),
      ...requiredMainColumns
    ])));
  };

  const buildAccountForms = (formName = selectedFormName) => selectedAccountIds.map(accId => {
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
      const res = await api.post('/exports/preview-sites', {
        account_forms: accountForms,
        form_name: formName
      });
      const columns = Array.isArray(res.data.columns) ? res.data.columns.map(String) : [];
      applyMainExportColumns(columns, resetSelection);
    } catch {
      toast.error("Erreur chargement colonnes export.");
    } finally {
      setLoadingColumns(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('kobo_csv_prefs');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        const savedSeparator = prefs.sep || ';';
        const savedEncoding = normalizeCsvEncoding(savedSeparator, prefs.enc || 'utf-8-sig');
        if (prefs.format) setExportFormat(prefs.format);
        if (prefs.sep) setCsvSeparator(savedSeparator);
        setCsvEncoding(savedEncoding);
        if (prefs.quote) setCsvQuotechar(prefs.quote);
      } catch {
        localStorage.removeItem('kobo_csv_prefs');
      }
    }
    api.get('/google/status').then(res => setGoogleConnected(res.data.connected)).catch(() => setGoogleConnected(false));
  }, []);

  useEffect(() => {
    localStorage.setItem('kobo_csv_prefs', JSON.stringify({
        format: exportFormat, sep: csvSeparator, enc: csvEncoding, quote: csvQuotechar
    }));
  }, [exportFormat, csvSeparator, csvEncoding, csvQuotechar]);

  const { data: accounts } = useQuery<KoboAccount[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/kobo/accounts').then(res => res.data)
  });

  const exportMutation = useMutation({
    mutationFn: (data: any) => api.post('/exports/run', data),
    onSuccess: (res) => { setResult(res.data); toast.success('Export terminé avec succès'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || "Erreur pendant l'export."); }
  });

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
            const firstSheet = res.data.sheets[0].name;
            setSelectedSheets([firstSheet]);
            setSelectedColumns(res.data.sheets[0].columns);
            void fetchActualColumns(formName, true);
        }
    } catch (e: any) {
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

  // Détection automatique des sites quand le pivot est choisi
  useEffect(() => {
    if (pivot && selectedFormName && selectedAccountIds.length > 0) {
        fetchSites();
    }
    if (pivot) {
        setSelectedColumns(prev => prev.includes(pivot) ? prev : [...prev, pivot]);
    }
  }, [pivot]);

  const fetchSites = async () => {
    if (loadingSites || !selectedFormName || !pivot) return;
    setLoadingSites(true);
    try {
      const accountForms = buildAccountForms();

      const res = await api.post('/exports/preview-sites', {
        account_forms: accountForms,
        form_name: selectedFormName,
        pivot_column: pivot
      });
      const columns = Array.isArray(res.data.columns) ? res.data.columns.map(String) : [];
      applyMainExportColumns(columns);
      setAvailableSites(res.data.sites || []);
      setSelectedSites(res.data.sites || []); 
    } catch (e: any) {
      toast.error("Erreur détection sites.");
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    const missingIds = selectedAccountIds.filter(id => !accountFormsMap[id] && !loadingAccountIds.includes(id));

    if (missingIds.length > 0) {
      const fetchMissing = async () => {
        const id = missingIds[0];
        setLoadingAccountIds(prev => [...prev, id]);
        try {
          const res = await api.get<KoboForm[]>(`/kobo/forms/${id}`);
          setAccountFormsMap(prev => {
            const updated = { ...prev, [id]: res.data };
            return updated;
          });
        } catch (e) {
          toast.error("Erreur chargement compte.");
        } finally {
          setLoadingAccountIds(prev => prev.filter(x => x !== id));
        }
      };
      fetchMissing();
    }
  }, [selectedAccountIds, accountFormsMap, loadingAccountIds]);

  useEffect(() => {
    recompute(selectedAccountIds, accountFormsMap);
  }, [selectedAccountIds, accountFormsMap]);

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

    // On utilise les noms normalisés pour l'intersection
    const normalize = (s: string) => s.trim().toLowerCase();

    let commonNames = new Set(lists[0].map(f => normalize(f.name)));
    
    for (let i = 1; i < lists.length; i++) {
        const currentNames = new Set(lists[i].map(f => normalize(f.name)));
        commonNames = new Set([...commonNames].filter(n => currentNames.has(n)));
    }

    // On garde les objets originaux du premier compte qui matchent
    const filtered = lists[0].filter(f => commonNames.has(normalize(f.name)));
    setCommonForms(filtered);
    
    if (filtered.length === 0 && newIds.length > 1) {
        toast.error("Aucun formulaire commun trouvé entre ces comptes.", { id: 'no-common' });
    }
  };

  const handlePreview = async () => {
    if (!selectedFormName || selectedSheets.length === 0) {
        toast.error("Choisissez un onglet."); return;
    }
    setLoadingPreview(true);
    try {
        const accountForms = buildAccountForms();
        const requestEncoding = normalizeCsvEncoding(csvSeparator, csvEncoding);
        const res = await api.post('/exports/preview', {
            account_forms: accountForms, form_name: selectedFormName,
            csv_separator: csvSeparator, csv_encoding: requestEncoding, csv_quotechar: csvQuotechar,
            selected_sheets: selectedSheets
        });
        setCsvPreview(res.data.preview);
    } catch (e) { toast.error("Erreur aperçu."); } finally { setLoadingPreview(false); }
  };

  const handleRun = () => {
    if (selectedAccountIds.length === 0 || !selectedFormName) { toast.error("Config incomplète."); return; }
    if (selectedSheets.length === 0) { toast.error("Sélectionnez au moins un onglet."); return; }
    if (exportFormat === 'csv' && selectedSheets.length > 1) { toast.error("Le format CSV ne supporte qu'un seul onglet."); return; }
    
    setResult(null);
    const accountForms = buildAccountForms();
    const requestEncoding = normalizeCsvEncoding(csvSeparator, csvEncoding);

    exportMutation.mutate({
      account_forms: accountForms, form_name: selectedFormName, pivot_column: pivot || undefined,
      selected_columns: selectedColumnsForExport, selected_sheets: selectedSheets,
      filter_sites: pivot ? selectedSites : undefined, 
      drive_folder_id: driveFolderId.trim() || undefined,
      export_format: exportFormat, csv_separator: csvSeparator, csv_encoding: requestEncoding, csv_quotechar: csvQuotechar
    });
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Exports</p>
          <h1 className="page-title text-linear-primary">Export par Site</h1>
          <p className="page-subtitle">Fusion multi-comptes, partitionnement géographique et conversion Sheets.</p>
        </div>
        <div className={`status-pill ${googleConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${googleConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span>{googleConnected ? 'Drive Cloud On' : 'Drive Off-line'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Step 1: Accounts */}
        <div className="surface-panel p-4 space-y-3">
          <div className="section-label">
            <Users size={13} className="text-gray-400" />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">1. Sélection des Comptes <span className="text-red-500">*</span></span>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white overflow-y-auto h-[180px] px-1 py-1 space-y-0.5 custom-scrollbar">
            {accounts?.map(acc => (
              <label key={acc.id} className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${selectedAccountIds.includes(acc.id) ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'hover:bg-gray-50 text-gray-600'}`}>
                 <div className="flex items-center gap-3 min-w-0">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={selectedAccountIds.includes(acc.id)} onChange={() => toggleAccount(acc.id)} />
                    <span className="text-[12px] font-bold truncate">{acc.name}</span>
                 </div>
                 {loadingAccountIds.includes(acc.id) && <RefreshCw size={10} className="text-indigo-500 animate-spin shrink-0" />}
              </label>
            ))}
          </div>
        </div>

        {/* Step 2: Form & Sheets */}
        <div className={`surface-panel p-4 space-y-4 ${selectedAccountIds.length === 0 ? 'step-locked' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="section-label">
              <Database size={13} className="text-gray-400" />
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">2. Formulaire & Onglets <span className="text-red-500">*</span></span>
            </div>
            {loadingAccountIds.length > 0 && <RefreshCw size={12} className="text-indigo-500 animate-spin" />}
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Formulaire Source</label>
                    {commonForms.length > 0 && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{commonForms.length} communs</span>}
                </div>
                <div className="relative">
                    <select
                        className={`input-linear font-semibold h-9 ${loadingAccountIds.length > 0 ? 'opacity-50' : ''}`}
                        disabled={loadingAccountIds.length > 0 || (commonForms.length === 0 && loadingAccountIds.length === 0 && selectedAccountIds.length > 0)}
                        value={selectedFormName}
                        onChange={e => fetchStructure(e.target.value)}
                    >
                        <option value="">{loadingAccountIds.length > 0 ? 'Chargement des formulaires...' : 'Sélectionner le formulaire'}</option>
                        {commonForms.map(f => <option key={f.uid} value={f.name}>{f.name}</option>)}
                    </select>
                    {loadingAccountIds.length > 0 && (
                        <div className="absolute right-8 top-1/2 -translate-y-1/2">
                            <RefreshCw className="animate-spin text-indigo-500" size={12} />
                        </div>
                    )}
                </div>
                {loadingStructure && (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2 animate-in fade-in slide-in-from-top-1 duration-300">
                        <p className="text-[10px] text-indigo-600 font-medium flex items-center gap-2">
                            <RefreshCw className="animate-spin" size={10} />
                            Analyse de la structure Kobo...
                        </p>
                    </div>
                )}
                {loadingColumns && (
                    <div className="bg-violet-50/60 border border-violet-100 rounded-lg p-2 animate-in fade-in slide-in-from-top-1 duration-300">
                        <p className="text-[10px] text-violet-600 font-medium flex items-center gap-2">
                            <RefreshCw className="animate-spin" size={10} />
                            Lecture des colonnes exportées...
                        </p>
                    </div>
                )}
            </div>

            {/* SELECTION ONGLET (Maintenant ici pour être visible) */}
            <div className="space-y-1.5 animate-in fade-in duration-300">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-tight flex items-center gap-1.5">
                    <Layers size={11} className="text-indigo-400" />
                    Onglet(s) à exporter
                </label>
                <div className="border border-gray-200 rounded-lg bg-white overflow-y-auto max-h-[100px] px-1 py-1 space-y-0.5 custom-scrollbar bg-gray-50/30">
                    {formStructure?.sheets.length ? (
                        formStructure.sheets.map(sh => (
                            <label key={sh.name} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${selectedSheets.includes(sh.name) ? 'bg-white shadow-sm ring-1 ring-indigo-100' : 'hover:bg-white/50'}`}>
                                <input 
                                    type={exportFormat === 'csv' ? 'radio' : 'checkbox'} 
                                    name="sheet_selector"
                                    className="w-3 h-3 text-indigo-600 focus:ring-0" 
                                    checked={selectedSheets.includes(sh.name)} 
                                    onChange={() => handleSheetToggle(sh.name)} 
                                />
                                <span className={`text-[11px] truncate ${selectedSheets.includes(sh.name) ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{sh.name}</span>
                            </label>
                        ))
                    ) : (
                        <p className="text-[10px] text-gray-400 italic p-2 text-center">Aucun onglet chargé</p>
                    )}
                </div>
                {exportFormat === 'csv' && selectedSheets.length > 0 && (
                    <div className="mt-1 flex items-start gap-1 p-1 bg-amber-50 rounded border border-amber-100/50">
                        <AlertCircle size={10} className="text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-[9px] text-amber-700 leading-tight italic">Mode CSV : Un seul onglet possible.</p>
                    </div>
                )}
            </div>
          </div>
        </div>

        {/* Step 3: Geography & Pivot */}
        <div className={`surface-panel p-4 space-y-4 ${!selectedFormName || !formStructure ? 'step-locked' : ''}`}>
            <div className="section-label">
                <Activity size={13} className="text-gray-400" />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">3. Pivot Géographique <span className="text-red-500">*</span></span>
            </div>
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Colonne des sites</label>
                    <div className="flex gap-1.5">
                        <select className="input-linear font-medium" value={pivot} onChange={e => setPivot(e.target.value)}>
                            <option value="">-- Choisir --</option>
                            {mainSheetColumns.map((c, index) => <option key={`${c}-${index}`} value={c}>{c}</option>)}
                        </select>
                        <button onClick={fetchSites} className="btn-primary-linear !px-2.5 !bg-indigo-50 !text-indigo-600 border-indigo-100 hover:!bg-indigo-600 hover:!text-white" disabled={loadingSites || !pivot}>
                            {loadingSites ? <RefreshCw className="animate-spin" size={13} /> : <Search size={14} />}
                        </button>
                    </div>
                    {!selectedSheets[0] && <p className="text-[9px] text-red-400 italic mt-1">Sélectionnez un onglet d'abord.</p>}
                </div>

                <div className="pt-2 border-t border-gray-100">
                    <div className="flex gap-2">
                        <button onClick={() => setExportFormat('xlsx')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${exportFormat === 'xlsx' ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>EXCEL</button>
                        <button onClick={() => setExportFormat('csv')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${exportFormat === 'csv' ? 'bg-gray-900 border-gray-900 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>CSV</button>
                    </div>
                </div>
            </div>
        </div>

        {/* Step 4: Finalize */}
        <div className={`surface-panel p-4 space-y-4 flex flex-col ${selectedSheets.length === 0 ? 'step-locked' : ''}`}>
          <div className="section-label">
            <Link size={13} className="text-gray-400" />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">4. Destination & Lancement <span className="text-red-500">*</span></span>
          </div>
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="space-y-3">
                <input className="input-linear" placeholder="Dossier Drive (ID)" value={driveFolderId} onChange={e => setDriveFolderId(e.target.value)} />
                {exportFormat === 'csv' && (
                    <div className="flex gap-2 p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                        <select
                            className="flex-1 bg-transparent border-none text-[10px] font-bold text-gray-600 focus:ring-0"
                            value={csvSeparator}
                            onChange={e => {
                                const nextSeparator = e.target.value;
                                setCsvSeparator(nextSeparator);
                                setCsvEncoding(prev => normalizeCsvEncoding(nextSeparator, prev));
                            }}
                        >
                            <option value=";">Point-virgule</option>
                            <option value=",">Virgule</option>
                        </select>
                        <select
                            className="flex-1 bg-transparent border-none text-[10px] font-bold text-gray-600 focus:ring-0"
                            value={csvEncoding}
                            onChange={e => setCsvEncoding(normalizeCsvEncoding(csvSeparator, e.target.value))}
                        >
                            <option value="utf-8-sig">UTF-8 BOM</option>
                            <option value="utf-8">UTF-8 simple</option>
                            <option value="windows-1252">Windows-1252</option>
                        </select>
                    </div>
                )}
            </div>
            <div className="mt-auto flex flex-col gap-2">
                {exportFormat === 'csv' && (
                    <button onClick={handlePreview} disabled={loadingPreview || !selectedSheets[0]} className="w-full py-1.5 rounded-lg border border-indigo-100 text-indigo-600 text-[10px] font-bold uppercase hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
                        {loadingPreview ? <RefreshCw className="animate-spin" size={12} /> : <Eye size={12} />}
                        Aperçu
                    </button>
                )}
                <button 
                  onClick={handleRun}
                  disabled={exportMutation.isPending || selectedSheets.length === 0}
                  className={`btn-primary-linear !h-11 !px-4 flex items-center justify-center gap-3 ${exportMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {exportMutation.isPending ? <RefreshCw className="animate-spin text-white" size={16} /> : <Send size={15} className="text-white" />}
                  <span className="text-[13px] font-bold text-white uppercase tracking-wider">Lancer l'Export</span>
                </button>
            </div>
          </div>
        </div>
      </div>

      {csvPreview && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 surface-panel overflow-hidden relative z-20">
              <div className="px-6 py-3 bg-indigo-600 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-white" />
                    <span className="text-[11px] font-bold text-white tracking-[0.2em] uppercase">Validation de structure CSV</span>
                  </div>
                  <button onClick={() => setCsvPreview(null)} className="text-white/80 hover:text-white text-[10px] font-bold px-3 py-1 bg-white/10 rounded-full transition-colors uppercase">Ignorer</button>
              </div>
              <pre className="p-6 text-[12px] font-mono whitespace-pre overflow-x-auto text-gray-800 bg-gray-50/50 custom-scrollbar max-h-[250px]">
                  {csvPreview}
              </pre>
          </div>
      )}

      {/* Primary Workspace: Sites Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 pt-4">
        <div className="surface-panel overflow-hidden flex flex-col h-[660px]">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                    <LayoutGrid size={16} className="text-indigo-600" />
                </div>
                <div>
                    <span className="text-[14px] font-bold text-gray-900 block">Secteurs & Sites ({selectedSites.length})</span>
                    <p className="text-[10px] text-gray-400 font-medium tracking-tight">Sélectionnez les lots à exporter</p>
                </div>
             </div>
             <div className="flex gap-4">
                <button onClick={() => setSelectedSites(availableSites)} className="btn-secondary-linear !h-7 !px-3 !text-[11px] !text-indigo-600">Tout cocher</button>
                <button onClick={() => setSelectedSites([])} className="btn-secondary-linear !h-7 !px-3 !text-[11px] !text-gray-500 uppercase">Tout décocher</button>
             </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar">
            {!pivot ? (
               <div className="flex-1 flex flex-col items-center justify-center h-full text-center py-20 grayscale opacity-20">
                  <Layers size={64} strokeWidth={1} className="mb-6 text-indigo-900" />
                  <p className="text-[14px] font-bold uppercase tracking-[0.3em] text-gray-900">Partitionnement Inactif</p>
                  <p className="text-[11px] mt-2 text-gray-500 max-w-[250px] mx-auto">Veuillez configurer un formulaire et une colonne pivot pour isoler les sites de collecte.</p>
               </div>
            ) : loadingSites ? (
                <div className="flex-1 flex flex-col items-center justify-center h-full py-20 text-center animate-pulse">
                    <RefreshCw size={32} className="text-indigo-500 animate-spin mb-4" />
                    <p className="text-[12px] font-bold text-indigo-600 uppercase tracking-widest leading-relaxed">Récupération des sites...</p>
                </div>
            ) : availableSites.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center h-full py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Search size={24} className="text-gray-200" />
                    </div>
                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">Aucun site détecté<br/><span className="text-[10px] font-normal lowercase tracking-normal">Lancez la recherche via le pivot</span></p>
                </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {availableSites.map(s => (
                  <button key={s} onClick={() => setSelectedSites(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s])} className={`group relative p-4 rounded-lg border transition-all text-left overflow-hidden ${selectedSites.includes(s) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-100' : 'bg-white border-gray-100 text-gray-700 hover:border-indigo-200 hover:shadow-sm'}`}>
                    <span className="text-[12px] font-bold relative z-10 block truncate pr-6">{s}</span>
                    <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedSites.includes(s) ? 'bg-white border-white' : 'border-gray-100 group-hover:border-indigo-200'}`}>
                        {selectedSites.includes(s) && <Check size={10} className="text-indigo-600 font-bold" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {mainSheetColumns.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/50">
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
                    <Settings2 size={15} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
                      Colonnes premier onglet ({selectedMainColumnCount}/{mainSheetColumns.length})
                      {loadingColumns && <RefreshCw size={11} className="text-violet-500 animate-spin shrink-0" />}
                    </span>
                    <p className="text-[10px] text-gray-400 font-medium truncate">{mainSheet?.name}</p>
                  </div>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={selectAllMainColumns} className="btn-secondary-linear !h-7 !px-3 !text-[11px] !text-indigo-600">Tout cocher</button>
                  <button onClick={deselectOptionalMainColumns} className="btn-secondary-linear !h-7 !px-3 !text-[11px] !text-gray-500 uppercase">Tout décocher</button>
                </div>
              </div>
              <div className="max-h-[210px] overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {mainSheetColumns.map((column, index) => {
                    const required = isRequiredMainColumn(column);
                    const checked = required || selectedColumns.includes(column);
                    return (
                      <label key={`${column}-${index}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${required ? 'bg-indigo-50/70 border-indigo-100 text-indigo-700' : checked ? 'bg-white border-gray-200 text-gray-800 shadow-sm' : 'bg-white/70 border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-70"
                          checked={checked}
                          disabled={required}
                          onChange={() => toggleMainColumn(column)}
                        />
                        <span className="text-[11px] font-semibold truncate flex-1" title={column}>{column}</span>
                        {required && <span className="text-[8px] font-black uppercase tracking-tight bg-white/80 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">Fixe</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Execution Log: Dark Mode */}
        <div className="console-wrapper h-[660px]">
          <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${exportMutation.isPending ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em]">Console de Sortie</span>
          </div>
          <div ref={consoleRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar custom-scrollbar-dark font-mono text-[11px] leading-relaxed">
            {!exportMutation.isPending && !result && (
              <div className="text-center py-40 opacity-10 flex flex-col items-center">
                <Activity size={48} strokeWidth={1} className="text-white mb-4" />
                <p className="uppercase tracking-[0.4em] text-white">Standby</p>
              </div>
            )}
            {exportMutation.isPending && (
              <div className="space-y-3 animate-pulse">
                <p className="text-indigo-400">{" [SYSTEM] Initialisation de la fusion..."}</p>
                <p className="text-white/60">{" [PARAMS] Format : " + exportFormat.toUpperCase()}</p>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-[indeterminate_2s_infinite]"></div>
                </div>
              </div>
            )}
            {result && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest pb-4 border-b border-white/10 mb-4">
                  <CheckCircle size={14} /> Opération terminée
                </div>
                <div className="grid gap-2">
                  {result.files.map((f: any, i: number) => (
                    <div key={i} onClick={() => api.post('/exports/open', { path: f.path })} className="p-3 bg-white/[0.03] border border-white/5 rounded-lg hover:bg-white/[0.08] cursor-pointer group transition-all transform hover:-translate-x-1">
                       <div className="flex items-center gap-3">
                          <div className="bg-indigo-500/20 p-2 rounded-lg group-hover:bg-indigo-500 transition-colors">
                            <FolderOpen size={14} className="text-indigo-400 group-hover:text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                             <p className="text-[11px] font-bold text-white/90 truncate uppercase tracking-tight italic">{f.site}</p>
                             <p className="text-[10px] text-white/40">{f.rows} soumissions traitées</p>
                          </div>
                          <ChevronRight size={14} className="text-white/10 group-hover:text-white" />
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes indeterminate {
            0% { transform: translateX(-100%); width: 20%; }
            50% { width: 40%; }
            100% { transform: translateX(500%); width: 20%; }
        }
      `}</style>
    </div>
  );
};

export default ExportPage;
