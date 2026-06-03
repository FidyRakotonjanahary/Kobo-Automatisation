interface ExportHeaderProps {
  googleConnected: boolean;
}

export const ExportHeader = ({ googleConnected }: ExportHeaderProps) => (
  <div className="page-header">
    <div>
      <p className="page-kicker">Exports</p>
      <h1 className="page-title text-linear-primary">Export par Site</h1>
      <p className="page-subtitle">Fusion multi-comptes, partitionnement g{"\u00e9"}ographique et conversion Sheets.</p>
    </div>
    <div className={`status-pill ${googleConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${googleConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span>{googleConnected ? 'Drive Cloud On' : 'Drive Off-line'}</span>
    </div>
  </div>
);

