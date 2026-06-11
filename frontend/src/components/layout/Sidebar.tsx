import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, FileSpreadsheet, Image, LogIn, LogOut, ChevronRight } from 'lucide-react';
import api from '../../api/client';
import toast from 'react-hot-toast';

const Sidebar = () => {
  const [googleStatus, setGoogleStatus] = useState<{connected: boolean, email?: string}>({connected: false});

  useEffect(() => {
    checkGoogle();
  }, []);

  const checkGoogle = () => {
    api.get('/google/status')
      .then(res => setGoogleStatus(res.data))
      .catch(() => setGoogleStatus({connected: false}));
  };

  const handleLogin = () => {
    api.get('/google/login-url')
      .then(res => {
        window.location.href = res.data.url;
      })
      .catch(err => toast.error("Erreur d'initialisation Google : " + err.message));
  };

  const handleLogout = () => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-bold text-gray-900">Déconnexion Google ?</p>
          <p className="text-[10px] text-gray-500">Vous devrez vous reconnecter pour accéder au Drive.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => toast.dismiss(t.id)}
            className="px-2.5 py-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={() => {
              toast.dismiss(t.id);
              api.post('/google/logout').then(() => {
                setGoogleStatus({connected: false});
                toast.success("Déconnecté");
                setTimeout(() => window.location.reload(), 1000);
              });
            }}
            className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-md hover:bg-black transition-all shadow-sm"
          >
            Déconnecter
          </button>
        </div>
      </div>
    ), { duration: 4000, position: 'bottom-left' });
  };

  const links = [
    { to: '/accounts', icon: Users, label: 'Comptes Kobo' },
    { to: '/exports', icon: FileSpreadsheet, label: 'Export Sites' },
    { to: '/media', icon: Image, label: 'Migration Média' },
  ];

  return (
    <aside className="w-[244px] bg-[#0d0d10] h-screen flex flex-col border-r border-white/10 transition-all shadow-2xl shadow-black/10">
      {/* Brand */}
      <div className="p-5 flex items-center gap-2.5 border-b border-white/[0.06]">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-950/40" style={{ background: 'var(--gradient-action)' }}>
            <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
        <h1 className="text-sm font-semibold text-white tracking-tight">Kobo Suite</h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-[0.1em] mb-3 mt-1">Menu Principal</p>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `group flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                isActive
                  ? 'text-white border-white/10 bg-white/[0.08] shadow-sm'
                  : 'text-white/45 hover:text-white/75 border-transparent hover:bg-white/[0.04]'
              }`
            }
          >
            <div className="flex items-center gap-2.5">
              <link.icon size={14} className="opacity-80 group-hover:opacity-100" />
              <span className="text-[12px] font-semibold">{link.label}</span>
            </div>
            <ChevronRight size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* Connectivity footer */}
      <div className="p-4 mt-auto border-t border-white/[0.06]">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.1em]">Connectivité</span>
        </div>
        
        {googleStatus.connected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-1 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <div className="flex flex-col min-w-0">
                <p className="text-[11px] text-white/70 truncate">{googleStatus.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full h-9 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] text-white/60 hover:text-white/90 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={12} /> Déconnexion
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="w-full h-9 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] text-white/60 hover:text-white/90 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-2"
          >
            <LogIn size={12} /> Connexion Google
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
