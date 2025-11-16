function EmptyState({ title = 'Noch keine Einträge vorhanden', message, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white/80 p-8 text-center text-sm text-gray-500">
      <svg
        viewBox="0 0 120 90"
        role="presentation"
        aria-hidden="true"
        className="h-24 w-32 text-blue-200"
      >
        <path
          d="M15 70h90"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="6 12"
        />
        <rect
          x="28"
          y="20"
          width="64"
          height="40"
          rx="8"
          fill="currentColor"
          opacity="0.3"
        />
        <rect x="22" y="26" width="76" height="40" rx="10" fill="currentColor" opacity="0.15" />
        <rect x="32" y="34" width="36" height="6" rx="3" fill="currentColor" opacity="0.45" />
        <rect x="32" y="46" width="48" height="6" rx="3" fill="currentColor" opacity="0.35" />
      </svg>
      <p className="text-base font-semibold text-gray-700">{title}</p>
      {message && <p className="text-sm text-gray-500">{message}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
