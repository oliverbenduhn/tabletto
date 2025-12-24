import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import Header from '../components/Layout/Header';
import api from '../services/api';

function CalendarPage() {
  const navigate = useNavigate();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [calendarView, setCalendarView] = useState('dayGridMonth');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const calendarRef = useRef(null);

  useEffect(() => {
    loadMedications();
  }, []);

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 640);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    let active = true;
    api.getPreferences()
      .then(({ preferences }) => {
        if (!active) return;
        if (preferences?.calendarView) {
          setCalendarView(preferences.calendarView);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setPreferencesLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi && calendarApi.view.type !== calendarView) {
      calendarApi.changeView(calendarView);
    }
  }, [calendarView, preferencesLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    api.updatePreferences({ calendarView }).catch(() => {});
  }, [calendarView, preferencesLoaded]);

  const loadMedications = async () => {
    try {
      setLoading(true);
      const data = await api.getMedications();
      setMedications(data.medications || []);
      setError('');
    } catch (err) {
      setError('Fehler beim Laden der Medikamente: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Konvertiere Medikamente in FullCalendar Events
  const events = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return medications
      .filter(med => med.depletion_date)
      // Sortiere nach days_remaining (aufsteigend) - kritischste zuerst
      .sort((a, b) => (a.days_remaining || 999) - (b.days_remaining || 999))
      .map(med => {
        const depletionDate = new Date(med.depletion_date);
        depletionDate.setHours(0, 0, 0, 0);

        // Start-Datum ist heute
        const startDate = new Date(today);

        // End-Datum ist depletion_date + 1 Tag (FullCalendar end ist exklusiv)
        const endDate = new Date(depletionDate);
        endDate.setDate(endDate.getDate() + 1);

        // Farbe basierend auf Dringlichkeit
        let backgroundColor, borderColor, textColor;
        const daysRemaining = med.days_remaining || 0;

        if (daysRemaining <= 0) {
          backgroundColor = '#dc2626'; // red-600
          borderColor = '#991b1b'; // red-800
          textColor = '#ffffff';
        } else if (daysRemaining <= 3) {
          backgroundColor = '#ef4444'; // red-500
          borderColor = '#dc2626'; // red-600
          textColor = '#ffffff';
        } else if (daysRemaining <= 7) {
          backgroundColor = '#f59e0b'; // amber-500
          borderColor = '#d97706'; // amber-600
          textColor = '#ffffff';
        } else if (daysRemaining <= 14) {
          backgroundColor = '#fbbf24'; // amber-400
          borderColor = '#f59e0b'; // amber-500
          textColor = '#78350f'; // amber-900
        } else {
          backgroundColor = '#10b981'; // green-500
          borderColor = '#059669'; // green-600
          textColor = '#ffffff';
        }

        return {
          id: med.id.toString(),
          title: med.name,
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          backgroundColor,
          borderColor,
          textColor,
          daysRemaining: med.days_remaining || 0,
          extendedProps: {
            medication: med,
            daysRemaining: med.days_remaining,
            currentStock: med.current_stock,
            dailyConsumption: med.daily_consumption,
            depletionDate: depletionDate.toISOString().split('T')[0]
          }
        };
      });
  }, [medications]);

  const handleEventClick = (info) => {
    const medId = info.event.id;
    navigate(`/medication/${medId}`);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-4xl">⏳</div>
            <p className="text-gray-600">Lade Kalender...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Medikamenten-Kalender</h1>
          <p className="mt-2 text-gray-600">
            Übersicht über die Verfügbarkeit Ihrer Medikamente
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
            initialView={calendarView}
            headerToolbar={{
              left: isMobile ? 'prev,next' : 'prev,next today',
              center: 'title',
              right: isMobile ? 'listMonth' : 'dayGridMonth,listMonth'
            }}
            locale="de"
            buttonText={{
              today: 'Heute',
              month: 'Monat',
              week: 'Woche',
              list: 'Liste'
            }}
            events={events}
            eventClick={handleEventClick}
            eventOrder="daysRemaining"
            height="auto"
            firstDay={1}
            weekNumbers={!isMobile}
            weekText="KW"
            dayHeaderFormat={{ weekday: isMobile ? 'narrow' : 'short' }}
            displayEventTime={false}
            fixedWeekCount={false}
            showNonCurrentDates={false}
            datesSet={(arg) => {
              if (arg.view.type !== calendarView) {
                setCalendarView(arg.view.type);
              }
            }}
            dayCellDidMount={(arg) => {
              const dateStr = arg.date.toISOString().split('T')[0];
              // Finde Medikamente, die an diesem Tag leer gehen
              const depletingToday = events.filter(e => e.extendedProps.depletionDate === dateStr);

              if (depletingToday.length > 0) {
                // Erstelle roten Indikator für jedes Medikament
                depletingToday.forEach(event => {
                  const indicator = document.createElement('div');
                  indicator.className = 'fc-daygrid-day-top';
                  if (isMobile) {
                    indicator.style.cssText = 'background: #dc2626; color: white; padding: 0 6px; border-radius: 999px; font-size: 10px; font-weight: 700; text-align: center; margin: 2px; display: inline-block;';
                    indicator.textContent = '!';
                  } else {
                    indicator.style.cssText = 'background: #dc2626; color: white; padding: 2px 4px; border-radius: 4px; font-size: 10px; font-weight: bold; text-align: center; margin: 2px;';
                    indicator.textContent = `⚠️ ${event.title} leer`;
                  }
                  arg.el.querySelector('.fc-daygrid-day-frame')?.prepend(indicator);
                });
              }
            }}
            eventDidMount={(arg) => {
              console.log('🟩 eventDidMount called for:', arg.event.title);
              console.log('   View type:', arg.view?.type);

              // Only process list view events
              if (!arg.view?.type?.startsWith('list')) {
                console.log('   ❌ Not list view, skipping');
                return;
              }

              console.log('   arg.el:', arg.el);
              console.log('   arg.el HTML:', arg.el?.outerHTML);

              // Find the title cell in the list view
              const titleCell = arg.el.querySelector('.fc-list-event-title');
              console.log('   Title cell:', titleCell);

              if (!titleCell) {
                console.log('   ❌ No title cell found');
                return;
              }

              // Find the list day row this event belongs to
              const eventRow = arg.el;
              let listDayRow = eventRow.previousElementSibling;
              let iterations = 0;
              while (listDayRow && !listDayRow.classList.contains('fc-list-day')) {
                listDayRow = listDayRow.previousElementSibling;
                iterations++;
                if (iterations > 10) {
                  console.log('   ❌ Too many iterations');
                  break;
                }
              }

              const listDate = listDayRow?.getAttribute('data-date');
              const depletionDate = arg.event.extendedProps?.depletionDate;

              console.log('   List date:', listDate, 'Depletion:', depletionDate);

              if (!listDate || !depletionDate) {
                console.log('   ❌ Missing dates');
                return;
              }

              // Calculate days remaining from this list date
              const dayMs = 24 * 60 * 60 * 1000;
              const listDayStart = new Date(`${listDate}T00:00:00`);
              const depletionDayStart = new Date(`${depletionDate}T00:00:00`);
              const diffDays = Math.max(0, Math.round((depletionDayStart - listDayStart) / dayMs));

              console.log('   Calculated diff days:', diffDays);

              // Create content with medication name and remaining days
              const content = document.createElement('div');
              content.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%;';

              const nameSpan = document.createElement('span');
              nameSpan.textContent = arg.event.title;
              nameSpan.style.cssText = 'font-weight: 600;';

              const daysSpan = document.createElement('span');
              daysSpan.textContent = diffDays <= 0 ? '⛔ LEER' : `${diffDays} Tag${diffDays !== 1 ? 'e' : ''}`;
              daysSpan.style.cssText = 'font-size: 0.85em; opacity: 0.8; margin-left: 8px;';

              content.appendChild(nameSpan);
              content.appendChild(daysSpan);

              // Clear and append using safe DOM methods
              while (titleCell.firstChild) {
                titleCell.removeChild(titleCell.firstChild);
              }
              titleCell.appendChild(content);

              console.log('   ✅ Content updated');

              // Add badge to list day header if this medication depletes today
              if (listDate === depletionDate && listDayRow) {
                const dayHeader = listDayRow.querySelector('.fc-list-day-cushion');
                if (dayHeader && !dayHeader.querySelector('.js-depletion-badge-' + arg.event.id)) {
                  const badge = document.createElement('span');
                  badge.className = 'js-depletion-badge-' + arg.event.id;
                  badge.textContent = ` ⚠️ ${arg.event.title} leer`;
                  badge.style.cssText = 'margin-left: 8px; background: #dc2626; color: white; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap;';
                  dayHeader.appendChild(badge);
                  console.log('   ✅ Badge added to day header');
                }
              }
            }}
            eventContent={(arg) => {
              const { daysRemaining } = arg.event.extendedProps;
              const isListView = arg.view?.type?.startsWith('list');

              return (
                <div className="fc-event-main-frame" style={{ padding: isMobile ? '1px 3px' : '2px 4px' }}>
                  <div className="fc-event-title-container">
                    <div className="fc-event-title fc-sticky" style={{ fontWeight: 600, fontSize: isMobile ? '11px' : '12px' }}>
                      {arg.event.title}
                    </div>
                  </div>
                  <div
                    className="js-remaining-text"
                    data-depletion-date={arg.event.extendedProps.depletionDate}
                    style={{ fontSize: isMobile ? '9px' : '10px', opacity: 0.9, marginTop: isMobile ? '1px' : '2px' }}
                  >
                    {/* Initial value - will be updated by eventDidMount for list view */}
                    {isListView ? '...' : (daysRemaining <= 0 ? '⛔ LEER' : `${daysRemaining} Tag${daysRemaining !== 1 ? 'e' : ''}`)}
                  </div>
                </div>
              );
            }}
            dayMaxEvents={false}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-5">
          <div className="rounded-lg bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-red-600"></div>
              <div>
                <p className="font-semibold text-red-900">Leer</p>
                <p className="text-sm text-red-700">0 Tage</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-red-500"></div>
              <div>
                <p className="font-semibold text-red-900">Sehr kritisch</p>
                <p className="text-sm text-red-700">1-3 Tage</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-amber-500"></div>
              <div>
                <p className="font-semibold text-amber-900">Kritisch</p>
                <p className="text-sm text-amber-700">4-7 Tage</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-amber-400"></div>
              <div>
                <p className="font-semibold text-amber-900">Warnung</p>
                <p className="text-sm text-amber-700">8-14 Tage</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-green-500"></div>
              <div>
                <p className="font-semibold text-green-900">Gut</p>
                <p className="text-sm text-green-700">&gt; 14 Tage</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CalendarPage;
