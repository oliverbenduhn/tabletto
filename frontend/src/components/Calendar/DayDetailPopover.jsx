import { useEffect, useRef } from 'react';

function DayDetailPopover({ day, medications, depletingMedications = [], currentDate, position, onClose, onMedicationClick }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
  const formattedDate = dayDate.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const getStatusColor = (status) => {
    const colors = {
      critical: 'text-rose-700',
      warning: 'text-yellow-700',
      good: 'text-green-700'
    };
    return colors[status] || colors.good;
  };

  const getStatusIcon = (status) => {
    const icons = {
      critical: '⚠️',
      warning: '⏰',
      good: '✅'
    };
    return icons[status] || icons.good;
  };

  const getDaysUntilDepletion = (med) => {
    if (!med.depletion_date) return null;
    const depletionDate = new Date(med.depletion_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    depletionDate.setHours(0, 0, 0, 0);
    const diffTime = depletionDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={popoverRef}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Tag</p>
              <h3 className="text-lg font-semibold capitalize text-gray-900">{formattedDate}</h3>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Schließen"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto p-6">
          {medications.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p>Keine Medikamente an diesem Tag verfügbar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {depletingMedications.length > 0 && (
                <div className="rounded-lg bg-rose-500 p-3 text-white">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-semibold">
                        {depletingMedications.length} Medikament{depletingMedications.length !== 1 ? 'e gehen' : ' geht'} heute leer!
                      </p>
                      <p className="text-sm text-white/90">Nachschub besorgen</p>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-600">
                {medications.length} Medikament{medications.length !== 1 ? 'e' : ''} verfügbar:
              </p>
              {medications.map(med => {
                const daysLeft = getDaysUntilDepletion(med);
                const isDepleting = depletingMedications.some(d => d.id === med.id);
                return (
                  <button
                    key={med.id}
                    onClick={() => {
                      onMedicationClick(med.id);
                      onClose();
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition hover:shadow-md ${
                      isDepleting
                        ? 'border-rose-300 bg-rose-50 hover:border-rose-400'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-semibold ${isDepleting ? 'text-rose-900' : 'text-gray-900'}`}>
                            {med.name}
                          </span>
                          <span className="text-lg">{getStatusIcon(med.warning_status)}</span>
                          {isDepleting && (
                            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                              HEUTE LEER
                            </span>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="text-xs text-gray-400">Bestand:</span>
                            <span className="ml-1 font-medium">{med.current_stock}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Verbrauch/Tag:</span>
                            <span className="ml-1 font-medium">{med.daily_consumption}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {daysLeft !== null && (
                          <div className={`text-sm font-semibold ${getStatusColor(med.warning_status)}`}>
                            {daysLeft > 0 ? (
                              <>
                                {daysLeft} Tag{daysLeft !== 1 ? 'e' : ''}
                                <div className="text-xs font-normal text-gray-500">übrig</div>
                              </>
                            ) : daysLeft === 0 ? (
                              <>
                                Heute
                                <div className="text-xs font-normal text-gray-500">leer</div>
                              </>
                            ) : (
                              <>
                                {Math.abs(daysLeft)} Tag{Math.abs(daysLeft) !== 1 ? 'e' : ''}
                                <div className="text-xs font-normal text-gray-500">überfällig</div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {med.depletion_date && (
                      <div className="mt-2 text-xs text-gray-500">
                        Leer am: {new Date(med.depletion_date).toLocaleDateString('de-DE')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

export default DayDetailPopover;
