import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { KoboAccount, KoboForm } from '../types';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Database,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  User,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// ─── Composant : Tooltip générique ───────────────────────────────────────────

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

const Tooltip = ({ content, children, className = '' }: TooltipProps) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-[11px] leading-relaxed rounded-lg shadow-xl pointer-events-none"
          style={{ whiteSpace: 'normal', width: 'max-content', maxWidth: '280px' }}
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

// ─── Composant : Modal d'édition de compte ────────────────────────────────────

interface EditAccountModalProps {
  account: KoboAccount;
  onClose: () => void;
}

const EditAccountModal = ({ account, onClose }: EditAccountModalProps) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: account.name,
    username: account.username,
    base_url: account.base_url,
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.put(`/kobo/accounts/${account.id}`, {
        name: data.name || undefined,
        username: data.username || undefined,
        base_url: data.base_url || undefined,
        password: data.password.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Compte « ${form.name} » mis à jour avec succès.`);
      onClose();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      const msg = err?.response?.data?.detail || 'Erreur lors de la mise à jour.';
      toast.error(msg);
    },
  });

  const canSave =
    !updateMutation.isPending &&
    form.name.trim() !== '' &&
    form.username.trim() !== '';

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 animate-in zoom-in-95 duration-150">
        {/* En-tête modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center border border-indigo-100">
              <Edit2 size={13} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-900">Modifier le compte</p>
              <p className="text-[10px] text-gray-400 font-mono">{account.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Corps du formulaire */}
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="label-linear">Libellé *</label>
            <input
              className="input-linear"
              placeholder="ex: Instance Pro"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="label-linear">Username *</label>
            <input
              className="input-linear"
              placeholder="Utilisateur Kobo"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="label-linear">Instance Kobo</label>
            <input
              className="input-linear"
              placeholder="https://kf.kobotoolbox.org"
              value={form.base_url}
              onChange={e => setForm({ ...form, base_url: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="label-linear flex items-center gap-1.5">
              Nouveau mot de passe / API Key
              <span className="text-[10px] text-gray-400 font-normal normal-case tracking-normal">
                (laisser vide pour ne pas changer)
              </span>
            </label>
            <div className="relative">
              <input
                className="input-linear pr-9"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-[11px] text-indigo-800">
            <Shield size={12} className="shrink-0 mt-0.5 text-indigo-500" />
            <span>
              Le mot de passe/API Key est chiffré par AES-256 avant stockage. Laisser vide conserve le mot de passe existant.
            </span>
          </div>
        </div>

        {/* Pied de modal */}
        <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
          <button onClick={onClose} className="btn-secondary-linear" disabled={updateMutation.isPending}>
            Annuler
          </button>
          <button
            onClick={() => updateMutation.mutate(form)}
            disabled={!canSave}
            className="btn-primary-linear"
          >
            {updateMutation.isPending ? (
              <><RefreshCw size={11} className="animate-spin" /> Enregistrement…</>
            ) : (
              <><Save size={11} /> Enregistrer</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Types état de test ───────────────────────────────────────────────────────

type TestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

// ─── Composant sous-liste des formulaires d'un compte ─────────────────────────

interface AccountFormsDetailProps {
  account: KoboAccount;
}

const AccountFormsDetail = ({ account }: AccountFormsDetailProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: forms,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery<KoboForm[]>({
    queryKey: ['account-forms', account.id],
    queryFn: () => api.get(`/kobo/forms/${account.id}`).then(res => res.data),
    staleTime: 60 * 1000, // 1 minute de cache frais
  });

  const formatNumber = (num?: number) => (num ?? 0).toLocaleString('fr-FR');

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const filteredForms = useMemo(() => {
    if (!forms) return [];
    if (!searchTerm.trim()) return forms;
    const term = searchTerm.toLowerCase();
    return forms.filter(
      f => f.name.toLowerCase().includes(term) || f.uid.toLowerCase().includes(term)
    );
  }, [forms, searchTerm]);

  const totalSubmissions = useMemo(() => {
    if (!forms) return 0;
    return forms.reduce((acc, f) => acc + (f.submissions_count || 0), 0);
  }, [forms]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    void queryClient.invalidateQueries({ queryKey: ['account-forms', account.id] });
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="p-5 flex items-center justify-center gap-3 text-gray-500 text-xs bg-gray-50/70 border-t border-gray-100">
        <RefreshCw size={14} className="animate-spin text-indigo-600" />
        <span>Chargement des projets et formulaires de <strong>{account.name}</strong>...</span>
      </div>
    );
  }

  if (isError) {
    const errorMsg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Impossible de récupérer les formulaires";
    return (
      <div className="p-4 bg-rose-50/50 border-t border-rose-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-rose-700 text-xs">
          <AlertCircle size={14} className="shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-secondary-linear !h-7 !px-2.5 !text-[11px] text-rose-700 border-rose-200 hover:bg-rose-100/50"
        >
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} /> Réessayer
        </button>
      </div>
    );
  }

  if (!forms || forms.length === 0) {
    return (
      <div className="p-6 text-center bg-gray-50/60 border-t border-gray-100 space-y-1">
        <Layers size={18} className="mx-auto text-gray-300" />
        <p className="text-xs font-medium text-gray-600">Aucun projet / formulaire trouvé</p>
        <p className="text-[11px] text-gray-400">Ce compte Kobo ne contient aucun formulaire actif de type enquête.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/80 border-t border-b border-gray-200/80 p-4 space-y-3 animate-in fade-in duration-200">
      {/* Mini Header de l'accordéon */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-200/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
            <Layers size={13} className="text-indigo-600" />
            <span>Projets & Formulaires</span>
            <span className="ml-1 px-2 py-0.5 bg-indigo-100/80 text-indigo-700 rounded-full text-[10px] font-extrabold">
              {forms.length}
            </span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1 text-[11px] text-gray-600">
            <span>Total soumissions :</span>
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md text-[11px]">
              {formatNumber(totalSubmissions)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {forms.length > 3 && (
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="h-7 w-36 sm:w-48 pl-7 pr-2 text-[11px] border border-gray-200 rounded-md bg-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30"
              />
            </div>
          )}
          <button
            onClick={handleRefresh}
            title="Rafraîchir la liste"
            className="h-7 px-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={11} className={isFetching ? 'animate-spin text-indigo-600' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Liste des formulaires */}
      <div className="grid grid-cols-1 gap-1.5">
        {filteredForms.length === 0 ? (
          <p className="text-center py-4 text-xs text-gray-400 italic">Aucun formulaire ne correspond à la recherche.</p>
        ) : (
          filteredForms.map(form => {
            const baseUrlClean = account.base_url.replace(/\/+$/, '');
            const koboFormUrl = `${baseUrlClean}/#/forms/${form.uid}`;
            const subCount = form.submissions_count ?? 0;
            const formattedDate = formatDate(form.date_modified);

            return (
              <div
                key={form.uid}
                className="flex items-center justify-between p-2.5 bg-white border border-gray-200/90 rounded-lg hover:border-indigo-200 hover:shadow-xs transition-all text-xs group"
              >
                {/* Nom et infos du formulaire */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className={`p-1.5 rounded-md ${subCount > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate" title={form.name}>
                        {form.name}
                      </p>
                      <span className="font-mono text-[10px] text-gray-400 bg-gray-50 border border-gray-200/60 px-1.5 py-0.5 rounded shrink-0">
                        {form.uid}
                      </span>
                    </div>
                    {formattedDate && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Modifié le {formattedDate}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badge de soumissions + lien externe */}
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                      subCount > 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${subCount > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    <span className="font-mono">{formatNumber(subCount)}</span>
                    <span className="text-[10px] font-medium opacity-85">
                      {subCount > 1 ? 'soumissions' : 'soumission'}
                    </span>
                  </div>

                  <a
                    href={koboFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    title="Ouvrir dans KoboToolbox"
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Page Principale ──────────────────────────────────────────────────────────

const AccountsPage = () => {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery<KoboAccount[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/kobo/accounts').then(res => res.data),
  });

  // Diagnostic de santé backend : DB persistante ? clé secrète configurée ?
  const { data: healthData } = useQuery<{
    database: { type: string; host: string; persistent: boolean };
    security: { secret_key_configured: boolean; key_persistent: boolean };
    is_render: boolean;
  }>({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(res => res.data),
    staleTime: 60_000,
  });

  const [expandedAccountIds, setExpandedAccountIds] = useState<Set<number>>(new Set());
  const [editingAccount, setEditingAccount] = useState<KoboAccount | null>(null);

  // État de test individuel par compte (id -> TestState)
  const [testStates, setTestStates] = useState<Record<number, TestState>>({});

  const toggleAccountExpand = (id: number) => {
    setExpandedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    base_url: 'https://kf.kobotoolbox.org',
  });
  const [showAddPassword, setShowAddPassword] = useState(false);

  const addMutation = useMutation({
    mutationFn: (newAccount: typeof form) => api.post('/kobo/accounts', newAccount),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setForm({ name: '', username: '', password: '', base_url: 'https://kf.kobotoolbox.org' });
      setShowAddPassword(false);
      toast.success(
        `Compte « ${variables.name} » enregistré avec succès ! Identifiants chiffrés par AES-256.`,
        { duration: 5000 }
      );
    },
    onError: (err: { response?: { data?: { detail?: string } }; message?: string }) => {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Erreur lors de l'ajout du compte. Vérifiez les informations saisies.";
      toast.error(msg, { duration: 6000 });
    },
  });

  const testConnection = async (id: number) => {
    setTestStates(prev => ({ ...prev, [id]: { status: 'loading' } }));
    try {
      const res = await api.get<{ status: string; message?: string }>(`/kobo/test/${id}`);
      if (res.data.status === 'success') {
        const successMsg = res.data.message || 'Connexion réussie';
        setTestStates(prev => ({
          ...prev,
          [id]: { status: 'success', message: successMsg },
        }));
        toast.success(successMsg);
        setTimeout(() => {
          setTestStates(prev => ({ ...prev, [id]: { status: 'idle' } }));
        }, 5000);
      } else {
        const errorMsg = res.data.message || 'Échec de la connexion (identifiants ou URL invalides)';
        setTestStates(prev => ({
          ...prev,
          [id]: { status: 'error', message: errorMsg },
        }));
        toast.error(errorMsg);
        setTimeout(() => {
          setTestStates(prev => ({ ...prev, [id]: { status: 'idle' } }));
        }, 7000);
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (err as { message?: string })?.message
        || "Impossible d'établir la connexion avec le serveur Kobo";
      setTestStates(prev => ({
        ...prev,
        [id]: { status: 'error', message: detail },
      }));
      toast.error(detail);
      setTimeout(() => {
        setTestStates(prev => ({ ...prev, [id]: { status: 'idle' } }));
      }, 7000);
    }
  };

  const deleteAccount = async (id: number) => {
    toast(
      (t) => (
        <div className="flex flex-col gap-3 p-1">
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-bold text-gray-900">Supprimer ce compte ?</p>
            <p className="text-[10px] text-gray-500">Cette action est irréversible.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-2.5 py-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                const deleting = toast.loading('Suppression...');
                try {
                  await api.delete(`/kobo/accounts/${id}`);
                  queryClient.invalidateQueries({ queryKey: ['accounts'] });
                  setExpandedAccountIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                  setTestStates(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                  });
                  toast.success('Compte supprimé.', { id: deleting });
                } catch {
                  toast.error('Erreur suppression.', { id: deleting });
                }
              }}
              className="px-3 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-md hover:bg-rose-600 transition-all shadow-sm"
            >
              Supprimer
            </button>
          </div>
        </div>
      ),
      { duration: 5000, position: 'top-center' }
    );
  };

  const canSubmit = !addMutation.isPending && !!form.name.trim() && !!form.username.trim() && !!form.password.trim();

  return (
    <div className="page-shell-narrow">
      {/* Modal d'édition de compte */}
      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {/* Header with pill & tooltip de sécurité */}
      <div className="page-header">
        <div>
          <p className="page-kicker">Paramètres</p>
          <h1 className="page-title flex items-center gap-3">
            Comptes KoboToolbox
          </h1>
          <p className="page-subtitle">
            Gestion centralisée des accès serveurs sécurisée par AES-256 avec visualisation des projets et soumissions.
          </p>
        </div>
        <Tooltip content="Vos identifiants Kobo (API Key / mot de passe) sont chiffrés par AES-256 (Fernet) avant d'être stockés en base de données. Personne ne peut les lire en clair, y compris l'équipe technique.">
          <div className="status-pill bg-emerald-50 text-emerald-700 border-emerald-100 cursor-help gap-1.5 hover:bg-emerald-100/60 transition-colors">
            <CheckCircle size={10} />
            <span>Sécurisé</span>
            <Info size={9} className="text-emerald-500 opacity-70" />
          </div>
        </Tooltip>
      </div>

      {/* Bannière de diagnostic : DB non-persistante (SQLite sur Render) */}
      {healthData && !healthData.database.persistent && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="font-semibold">⚠️ Base de données éphémère détectée</p>
            <p className="mt-1 text-red-700">
              Le backend utilise <strong>SQLite</strong> sur Render (disque éphémère). Tous les comptes
              Kobo seront <strong>perdus à chaque redéploiement</strong>.
            </p>
            <p className="mt-1 text-red-700">
              👉 Allez dans votre tableau de bord Render → <em>Environment Variables</em> → ajoutez{' '}
              <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs">DATABASE_URL</code>{' '}
              avec votre URL PostgreSQL Neon.
            </p>
          </div>
        </div>
      )}

      {/* Bannière de diagnostic : SECRET_KEY non configurée */}
      {healthData && !healthData.security.key_persistent && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">⚠️ Clé de chiffrement temporaire</p>
            <p className="mt-1 text-amber-700">
              La variable{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">SECRET_KEY</code>{' '}
              n&apos;est pas configurée. Les mots de passe Kobo sont chiffrés avec une clé aléatoire
              générée à chaque démarrage.{' '}
              <strong>Les comptes ne seront plus déchiffrables après un redéploiement.</strong>
            </p>
            <p className="mt-1 text-amber-700">
              👉 Générez une clé Fernet stable :{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                python -c &quot;from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())&quot;
              </code>{' '}
              et ajoutez-la comme variable <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">SECRET_KEY</code> sur Render.
            </p>
          </div>
        </div>
      )}

      {/* Formulaire d'ajout d'un compte */}
      <div className="surface-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="section-label">
            <Plus size={14} className="text-gray-400" />
            <span>Ajouter un compte</span>
          </div>
          <Tooltip content="Vos identifiants sont chiffrés avec l'algorithme AES-256 (Fernet) avant d'être sauvegardés. Personne ne peut les consulter en clair.">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium cursor-help bg-emerald-50/70 border border-emerald-200/60 px-2 py-0.5 rounded-md hover:bg-emerald-100/60 transition-colors">
              <Shield size={11} className="text-emerald-600" />
              <span>Chiffré AES-256</span>
              <Info size={9} className="opacity-70" />
            </div>
          </Tooltip>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <label className="label-linear">Libellé *</label>
            <input
              className="input-linear"
              placeholder="ex: Instance Pro"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="label-linear">Username *</label>
            <input
              className="input-linear"
              placeholder="Utilisateur"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="label-linear">API Key / Pass *</label>
            <div className="relative">
              <input
                className="input-linear pr-9"
                type={showAddPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowAddPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                title={showAddPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showAddPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <button
            onClick={() => addMutation.mutate(form)}
            disabled={!canSubmit}
            className="btn-primary-linear xl:min-w-[132px]"
          >
            {addMutation.isPending ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Plus size={12} /> Enregistrer
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table avec accordéons des projets */}
      <div className="table-wrapper">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="table-header">
              <th className="px-3.5 py-2.5">Compte</th>
              <th className="px-3.5 py-2.5">Identifiant</th>
              <th className="px-3.5 py-2.5">Instance</th>
              <th className="px-3.5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400 text-xs italic">
                  Chargement...
                </td>
              </tr>
            ) : accounts?.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400 text-xs italic">
                  Aucun compte Kobo configuré.
                </td>
              </tr>
            ) : (
              accounts?.map(acc => {
                const isExpanded = expandedAccountIds.has(acc.id);
                const testState: TestState = testStates[acc.id] ?? { status: 'idle' };

                return (
                  <React.Fragment key={acc.id}>
                    <tr
                      onClick={() => toggleAccountExpand(acc.id)}
                      className={`table-row cursor-pointer select-none transition-colors ${
                        isExpanded ? 'bg-indigo-50/30 hover:bg-indigo-50/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Compte avec icône Chevron dépliable */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`text-gray-400 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90 text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            <ChevronRight size={14} />
                          </span>
                          <div className="w-6 h-6 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center justify-center border border-indigo-100">
                            {acc.name[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{acc.name}</span>
                            <span className="text-[10px] text-gray-400">
                              {isExpanded ? 'Cliquer pour masquer les projets' : 'Cliquer pour voir les projets & soumissions'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Identifiant */}
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5 text-gray-600 font-mono text-[11px]">
                          <User size={12} className="opacity-40" /> {acc.username}
                        </div>
                      </td>

                      {/* Instance */}
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px] truncate max-w-[150px]">
                          <Database size={12} className="opacity-40" /> {acc.base_url}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-right">
                        <div className="flex flex-col items-end gap-1.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1.5 justify-end items-center">
                            {/* Bouton Tester avec info-bulle explicative et état de chargement */}
                            <Tooltip content="Vérifie la connexion à l'instance KoboToolbox et la validité des identifiants (nom d'utilisateur et mot de passe/API Key).">
                              <button
                                onClick={() => void testConnection(acc.id)}
                                disabled={testState.status === 'loading'}
                                className={`btn-secondary-linear !h-7 !px-2.5 !text-[11px] ${
                                  testState.status === 'loading' ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                              >
                                {testState.status === 'loading' ? (
                                  <>
                                    <RefreshCw size={11} className="animate-spin text-indigo-600" />
                                    <span>Test…</span>
                                  </>
                                ) : (
                                  <>
                                    <Wifi size={11} />
                                    <span>Tester</span>
                                  </>
                                )}
                              </button>
                            </Tooltip>

                            {/* Bouton Modifier */}
                            <button
                              onClick={() => setEditingAccount(acc)}
                              className="btn-secondary-linear !h-7 !px-2.5 !text-[11px] text-gray-700 hover:text-indigo-600 hover:border-indigo-200"
                              title="Modifier ce compte (libellé, identifiant, mot de passe)"
                            >
                              <Edit2 size={11} />
                              <span>Modifier</span>
                            </button>

                            {/* Bouton Supprimer */}
                            <button
                              onClick={() => void deleteAccount(acc.id)}
                              className="btn-icon-linear !h-7 !w-7"
                              title="Supprimer ce compte"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Retour visuel inline du test de connexion */}
                          {testState.status === 'success' && (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium animate-in fade-in duration-200 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                              <CheckCircle size={10} className="text-emerald-600 shrink-0" />
                              <span>{testState.message}</span>
                            </div>
                          )}

                          {testState.status === 'error' && (
                            <div className="flex items-center gap-1.5 text-[10px] text-rose-700 font-medium animate-in fade-in duration-200 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md max-w-[280px] text-right">
                              <XCircle size={10} className="text-rose-500 shrink-0" />
                              <span className="truncate" title={testState.message}>
                                {testState.message}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Ligne accordéon pour la sous-liste des formulaires */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="p-0 bg-transparent">
                          <AccountFormsDetail account={acc} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Section informative sur la sécurité AES-256 */}
      <div className="surface-panel p-4 bg-slate-50/50 border border-gray-200/80 rounded-xl">
        <div className="flex items-start gap-3.5">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 border border-emerald-100 mt-0.5">
            <Shield size={16} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-bold text-gray-900">
                Sécurité &amp; Chiffrement des identifiants (AES-256 Fernet)
              </p>
              <span className="status-pill bg-emerald-50 text-emerald-700 border-emerald-100 !text-[9px]">
                <CheckCircle size={9} /> Protection active
              </span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Vos identifiants KoboToolbox (clés d&apos;API et mots de passe) sont <strong className="text-gray-700 font-semibold">automatiquement chiffrés par AES-256</strong> avant
              d&apos;être enregistrés dans la base de données. Personne ne peut les lire en clair, y compris l&apos;équipe technique.
              Seul le serveur backend détient la clé secrète (<code className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded text-gray-700">SECRET_KEY</code>) permettant de communiquer de manière sécurisée avec l&apos;API Kobo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountsPage;
