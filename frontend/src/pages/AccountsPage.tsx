import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { KoboAccount, KoboForm } from '../types';
import {
  Plus,
  Wifi,
  Trash2,
  Database,
  User,
  CheckCircle,
  ChevronRight,
  RefreshCw,
  FileText,
  ExternalLink,
  Layers,
  Search,
  AlertCircle
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';

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
    queryFn: () => api.get('/kobo/accounts').then(res => res.data)
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

  const [form, setForm] = useState({ name: '', username: '', password: '', base_url: 'https://kf.kobotoolbox.org' });

  const addMutation = useMutation({
    mutationFn: (newAccount: typeof form) => api.post('/kobo/accounts', newAccount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setForm({ name: '', username: '', password: '', base_url: 'https://kf.kobotoolbox.org' });
      toast.success("Compte ajouté !");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout du compte.");
    }
  });

  const testConnection = async (id: number) => {
    const t = toast.loading("Test de connexion...");
    try {
      const res = await api.get(`/kobo/test/${id}`);
      if (res.data.status === 'success') {
        toast.success('Connexion établie !', { id: t });
      } else {
        toast.error('Échec de la connexion', { id: t });
      }
    } catch {
      toast.error('Erreur de communication.', { id: t });
    }
  };

  const deleteAccount = async (id: number) => {
    toast((t) => (
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
              const deleting = toast.loading("Suppression...");
              try {
                await api.delete(`/kobo/accounts/${id}`);
                queryClient.invalidateQueries({ queryKey: ['accounts'] });
                setExpandedAccountIds(prev => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
                toast.success("Compte supprimé.", { id: deleting });
              } catch {
                toast.error("Erreur suppression.", { id: deleting });
              }
            }}
            className="px-3 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-md hover:bg-rose-600 transition-all shadow-sm"
          >
            Supprimer
          </button>
        </div>
      </div>
    ), { duration: 5000, position: 'top-center' });
  };

  const canSubmit = !addMutation.isPending && !!form.name && !!form.username && !!form.password;

  return (
    <div className="page-shell-narrow">
      {/* Header with pill */}
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
        <div className="status-pill bg-emerald-50 text-emerald-700 border-emerald-100">
            <CheckCircle size={10} />
            <span>Sécurisé</span>
        </div>
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

      {/* Mini Form */}
      <div className="surface-panel p-5 space-y-4">
        <div className="section-label">
            <Plus size={14} className="text-gray-400" />
            <span>Ajouter un compte</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <label className="label-linear">Libellé</label>
            <input
              className="input-linear"
              placeholder="ex: Instance Pro"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="label-linear">Username</label>
            <input
              className="input-linear"
              placeholder="Utilisateur"
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="label-linear">API Key / Pass</label>
            <input
              className="input-linear"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
            />
          </div>
          <button
            onClick={() => addMutation.mutate(form)}
            disabled={!canSubmit}
            className="btn-primary-linear xl:min-w-[132px]"
          >
            {addMutation.isPending ? 'En cours...' : <><Plus size={12} /> Enregistrer</>}
          </button>
        </div>
      </div>

      {/* Table with expandable accordions */}
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
              <tr><td colSpan={4} className="p-8 text-center text-gray-400 text-xs italic">Chargement...</td></tr>
            ) : accounts?.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400 text-xs italic">Aucun compte.</td></tr>
            ) : accounts?.map(acc => {
              const isExpanded = expandedAccountIds.has(acc.id);

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
                      <div className="flex gap-1 justify-end items-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => testConnection(acc.id)}
                          className="btn-secondary-linear"
                          title="Tester la connexion"
                        >
                          <Wifi size={10} /> Tester
                        </button>
                        <button
                          onClick={() => deleteAccount(acc.id)}
                          className="btn-icon-linear"
                          title="Supprimer ce compte"
                        >
                          <Trash2 size={13} />
                        </button>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountsPage;
