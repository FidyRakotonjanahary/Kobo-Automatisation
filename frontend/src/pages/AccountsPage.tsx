import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { KoboAccount } from '../types';
import { Plus, Wifi, Trash2, Database, User, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const AccountsPage = () => {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery<KoboAccount[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/kobo/accounts').then(res => res.data)
  });

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
            Gestion centralisée des accès serveurs sécurisée par AES-256.
          </p>
        </div>
        <div className="status-pill bg-emerald-50 text-emerald-700 border-emerald-100">
            <CheckCircle size={10} />
            <span>Sécurisé</span>
        </div>
      </div>

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

      {/* Minimal Table */}
      <div className="table-wrapper">
        <table className="w-full text-left">
          <thead>
            <tr className="table-header">
              <th className="px-3.5 py-2">Compte</th>
              <th className="px-3.5 py-2">Identifiant</th>
              <th className="px-3.5 py-2">Instance</th>
              <th className="px-3.5 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400 text-xs italic">Chargement...</td></tr>
            ) : accounts?.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400 text-xs italic">Aucun compte.</td></tr>
            ) : accounts?.map(acc => (
              <tr key={acc.id} className="table-row">
                <td className="table-cell">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center justify-center border border-indigo-100">
                      {acc.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{acc.name}</span>
                  </div>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[11px]">
                    <User size={12} className="opacity-40" /> {acc.username}
                  </div>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px] truncate max-w-[150px]">
                    <Database size={12} className="opacity-40" /> {acc.base_url}
                  </div>
                </td>
                <td className="table-cell text-right">
                  <div className="flex gap-1 justify-end items-center">
                    <button onClick={() => testConnection(acc.id)} className="btn-secondary-linear">
                      <Wifi size={10} /> Tester
                    </button>
                    <button onClick={() => deleteAccount(acc.id)} className="btn-icon-linear">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountsPage;
