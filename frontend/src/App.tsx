import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/layout/Sidebar';
import AccountsPage from './pages/AccountsPage';
import ExportPage from './pages/ExportPage';
import MediaPage from './pages/MediaPage';
import GoogleCallback from './pages/GoogleCallback';

function App() {
  return (
    <div className="app-shell">
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            fontSize: '12px',
            borderRadius: '8px',
            background: '#111827',
            color: '#e2e2e2',
            border: '0.5px solid rgba(255,255,255,0.1)',
            boxShadow: '0 18px 45px rgba(15,23,42,0.18)',
          },
        }}
      />
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/accounts" replace />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/exports" element={<ExportPage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/google-callback" element={<GoogleCallback />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
