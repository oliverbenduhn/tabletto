import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import Header from '../components/Layout/Header';
import api from '../services/api';

function CalendarPage() {
  const navigate = useNavigate();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMedications();
  }, []);

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

        // Start-Datum ist heute (wir zeigen nur zukünftige Verfügbarkeit)
        const startDate = new Date(Math.max(today.getTime(), today.getTime()));

        // End-Datum ist depletion_date + 1 Tag (FullCalendar end ist exklusiv)
        const endDate = new Date(depletionDate);
        endDate.setDate(endDate.getDate() + 1);

        // Farbe basierend auf Warning-Status
        let backgroundColor, borderColor;
        if (med.warning_status === 'critical') {
          backgroundColor = '#ef4444'; // red-500
          borderColor = '#dc2626'; // red-600
        } else if (med.warning_status === 'warning') {
          backgroundColor = '#f59e0b'; // amber-500
          borderColor = '#d97706'; // amber-600
        } else {
          backgroundColor = '#10b981'; // green-500
          borderColor = '#059669'; // green-600
        }

        return {
          id: med.id.toString(),
          title: med.name,
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          backgroundColor,
          borderColor,
          extendedProps: {
            medication: med,
            daysRemaining: med.days_remaining,
            currentStock: med.current_stock,
            dailyConsumption: med.daily_consumption
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

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,listMonth'
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
            height="auto"
            firstDay={1} // Montag als erster Tag
            weekNumbers={true}
            weekText="KW"
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              meridiem: false
            }}
            eventContent={(arg) => {
              const { medication, daysRemaining, currentStock } = arg.event.extendedProps;
              return (
                <div className="fc-event-main-frame px-1">
                  <div className="fc-event-title-container">
                    <div className="fc-event-title fc-sticky font-semibold">
                      {arg.event.title}
                    </div>
                  </div>
                  <div className="text-xs opacity-90">
                    Bestand: {currentStock} | {daysRemaining} Tag{daysRemaining !== 1 ? 'e' : ''}
                  </div>
                </div>
              );
            }}
            dayMaxEvents={3}
            moreLinkText="weitere"
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-green-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-green-500"></div>
              <div>
                <p className="font-semibold text-green-900">Gut versorgt</p>
                <p className="text-sm text-green-700">&gt; 14 Tage Bestand</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-amber-500"></div>
              <div>
                <p className="font-semibold text-amber-900">Warnung</p>
                <p className="text-sm text-amber-700">7-14 Tage Bestand</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-red-500"></div>
              <div>
                <p className="font-semibold text-red-900">Kritisch</p>
                <p className="text-sm text-red-700">&lt; 7 Tage Bestand</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CalendarPage;
