const STATUS_META = [
  { id: 'good', label: 'Stabil', barColor: 'bg-emerald-400/80', dotColor: 'bg-emerald-400' },
  { id: 'warning', label: 'Warnung', barColor: 'bg-amber-400/80', dotColor: 'bg-amber-400' },
  { id: 'critical', label: 'Kritisch', barColor: 'bg-rose-400/80', dotColor: 'bg-rose-400' }
];

function StatusDistribution({ counts }) {
  const total = counts.total || 0;

  if (!total) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
        <span>Statusverteilung</span>
        <span>{total} Einträge</span>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white shadow-inner">
        {STATUS_META.map(meta => {
          const value = counts[meta.id] || 0;
          if (!value) return null;
          return (
            <div
              key={meta.id}
              className={`h-full ${meta.barColor}`}
              style={{ flexGrow: value, flexBasis: 0 }}
            />
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        {STATUS_META.map(meta => (
          <div key={meta.id} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />
            <span className="font-medium text-slate-700">{counts[meta.id] || 0}</span>
            <span className="text-slate-400">{meta.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatusDistribution;
