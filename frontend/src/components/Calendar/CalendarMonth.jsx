import { useMemo, useState } from 'react';
import DayDetailPopover from './DayDetailPopover';

function CalendarMonth({ medications, currentDate, onMedicationClick }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

  // Berechne Kalenderdaten für den aktuellen Monat
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Erster und letzter Tag des Monats
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Wochentag des ersten Tages (0 = Sonntag, 6 = Samstag)
    // Konvertiere zu Montag = 0, Sonntag = 6
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const daysInMonth = lastDay.getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      year,
      month,
      firstDay,
      lastDay,
      startDayOfWeek,
      daysInMonth,
      today
    };
  }, [currentDate]);

  // Berechne für jeden Tag, welche Medikamente verfügbar sind und welche auslaufen
  const dayMedications = useMemo(() => {
    const result = {};

    for (let day = 1; day <= calendarData.daysInMonth; day++) {
      const dayDate = new Date(calendarData.year, calendarData.month, day);
      dayDate.setHours(0, 0, 0, 0);

      const availableMeds = [];
      const depletingMeds = [];

      medications.forEach(med => {
        if (!med.depletion_date) return;

        const depletionDate = new Date(med.depletion_date);
        depletionDate.setHours(0, 0, 0, 0);

        // Medikament ist an diesem Tag verfügbar, wenn depletion_date >= dayDate
        if (depletionDate >= dayDate) {
          availableMeds.push(med);

          // Prüfe, ob das Medikament genau an diesem Tag ausgeht
          if (depletionDate.getTime() === dayDate.getTime()) {
            depletingMeds.push(med);
          }
        }
      });

      result[day] = {
        available: availableMeds,
        depleting: depletingMeds
      };
    }

    return result;
  }, [medications, calendarData]);

  const handleDayClick = (day, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopoverPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setSelectedDay(day);
  };

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // Erstelle Array mit allen Tagen (inkl. leere Zellen am Anfang)
  const days = [];

  // Leere Zellen vor dem ersten Tag
  for (let i = 0; i < calendarData.startDayOfWeek; i++) {
    days.push({ isEmpty: true, key: `empty-${i}` });
  }

  // Tage des Monats
  for (let day = 1; day <= calendarData.daysInMonth; day++) {
    const dayDate = new Date(calendarData.year, calendarData.month, day);
    dayDate.setHours(0, 0, 0, 0);
    const isToday = dayDate.getTime() === calendarData.today.getTime();
    const isPast = dayDate < calendarData.today;
    const dayData = dayMedications[day] || { available: [], depleting: [] };

    days.push({
      day,
      isToday,
      isPast,
      medications: dayData.available,
      depletingMedications: dayData.depleting,
      key: `day-${day}`
    });
  }

  // Bestimme die Hintergrundfarbe der Tageskachel
  const getDayBackgroundClass = (meds, depletingMeds) => {
    // Wenn Medikamente an diesem Tag ausgehen -> Kräftiges Rot
    if (depletingMeds && depletingMeds.length > 0) {
      return 'bg-rose-500 border-rose-600';
    }

    if (meds.length === 0) return 'bg-gray-50';

    const hasCritical = meds.some(m => m.warning_status === 'critical');
    const hasWarning = meds.some(m => m.warning_status === 'warning');

    if (hasCritical) return 'bg-rose-50 border-rose-100';
    if (hasWarning) return 'bg-yellow-50 border-yellow-100';
    return 'bg-green-50 border-green-100';
  };

  const getMedicationChipClass = (status) => {
    const classes = {
      critical: 'bg-rose-100 text-rose-700 border-rose-200',
      warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      good: 'bg-green-100 text-green-700 border-green-200'
    };
    return classes[status] || classes.good;
  };

  return (
    <>
      <div className="grid grid-cols-7 gap-2">
        {/* Wochentag-Header */}
        {weekDays.map(day => (
          <div
            key={day}
            className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
          >
            {day}
          </div>
        ))}

        {/* Tageskacheln */}
        {days.map(dayData => {
          if (dayData.isEmpty) {
            return <div key={dayData.key} className="aspect-square" />;
          }

          const { day, isToday, isPast, medications: meds, depletingMedications: depletingMeds } = dayData;
          const bgClass = isPast ? 'bg-gray-100 opacity-60' : getDayBackgroundClass(meds, depletingMeds);
          const isDepletionDay = depletingMeds && depletingMeds.length > 0;

          return (
            <button
              key={dayData.key}
              onClick={(e) => !isPast && handleDayClick(day, e)}
              disabled={isPast}
              className={`group relative aspect-square overflow-hidden rounded-xl border p-2 transition ${bgClass} ${
                isPast ? 'cursor-default' : 'cursor-pointer hover:shadow-md'
              }`}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      isToday
                        ? 'flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white'
                        : isPast
                        ? 'text-gray-400'
                        : isDepletionDay
                        ? 'text-white'
                        : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </span>
                  {!isPast && meds.length > 0 && (
                    <span className={`text-[10px] font-medium ${isDepletionDay ? 'text-white' : 'text-gray-500'}`}>
                      {meds.length}
                    </span>
                  )}
                </div>

                {/* Depletion Day Indicator */}
                {!isPast && isDepletionDay && (
                  <div className="mt-1 flex items-center gap-1 rounded bg-white/20 px-1 py-0.5">
                    <span className="text-[10px] font-bold text-white">⚠️ {depletingMeds.length}x leer</span>
                  </div>
                )}

                {!isPast && meds.length > 0 && !isDepletionDay && (
                  <div className={`mt-1 grid flex-1 gap-0.5 overflow-hidden ${
                    meds.length <= 2 ? 'grid-cols-1' :
                    meds.length <= 4 ? 'grid-cols-2' :
                    meds.length <= 6 ? 'grid-cols-2' :
                    'grid-cols-2'
                  }`}>
                    {meds.slice(0, 8).map(med => (
                      <div
                        key={med.id}
                        className={`flex aspect-square items-center justify-center rounded border text-center text-[8px] font-semibold leading-tight ${getMedicationChipClass(
                          med.warning_status
                        )}`}
                        title={med.name}
                      >
                        <span className="truncate px-0.5">{med.name}</span>
                      </div>
                    ))}
                    {meds.length > 8 && (
                      <div className="flex aspect-square items-center justify-center rounded bg-gray-200 text-[8px] font-bold text-gray-600">
                        +{meds.length - 8}
                      </div>
                    )}
                  </div>
                )}
                {!isPast && meds.length > 0 && isDepletionDay && (
                  <div className={`mt-1 grid flex-1 gap-0.5 overflow-hidden ${
                    depletingMeds.length <= 2 ? 'grid-cols-1' :
                    depletingMeds.length <= 4 ? 'grid-cols-2' :
                    depletingMeds.length <= 6 ? 'grid-cols-2' :
                    'grid-cols-2'
                  }`}>
                    {depletingMeds.slice(0, 8).map(med => (
                      <div
                        key={med.id}
                        className="flex aspect-square items-center justify-center rounded border border-white/40 bg-white/20 text-center text-[8px] font-bold leading-tight text-white"
                        title={`${med.name} - HEUTE LEER`}
                      >
                        <span className="truncate px-0.5">{med.name}</span>
                      </div>
                    ))}
                    {depletingMeds.length > 8 && (
                      <div className="flex aspect-square items-center justify-center rounded border border-white/40 bg-white/20 text-[8px] font-bold text-white">
                        +{depletingMeds.length - 8}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <DayDetailPopover
          day={selectedDay}
          medications={dayMedications[selectedDay]?.available || []}
          depletingMedications={dayMedications[selectedDay]?.depleting || []}
          currentDate={currentDate}
          position={popoverPosition}
          onClose={() => setSelectedDay(null)}
          onMedicationClick={onMedicationClick}
        />
      )}
    </>
  );
}

export default CalendarMonth;
