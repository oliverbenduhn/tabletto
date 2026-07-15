import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import api from '../../services/api';
import Menu from '../Common/Menu';
import ImportExportDialog from '../Common/ImportExportDialog';
import packageJson from '../../../package.json';
import { getCurrentUser } from '../../services/auth';

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser() || {};
  const [showImportExport, setShowImportExport] = useState(false);

  const handleLogout = async () => {
    await api.logout();
    navigate('/login');
  };

  const handleImportSuccess = () => {
    setShowImportExport(false);
    window.location.reload();
  };

  const initials = user.email ? user.email.charAt(0).toUpperCase() : '?';

  const isCalendarPage = location.pathname === '/calendar';
  const isDashboardPage = location.pathname === '/dashboard';
  const isSettingsPage = location.pathname === '/settings';

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:py-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/dashboard" className="flex min-h-11 items-center gap-2 text-lg font-semibold text-blue-600 sm:text-xl">
              <span>Tabletto</span>
              <span className="hidden text-xs font-normal text-gray-400 sm:inline">v{packageJson.version}</span>
            </Link>
            <nav className="hidden gap-2 sm:flex">
              <Link
                to="/dashboard"
                className={`flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                  isDashboardPage
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/calendar"
                className={`flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                  isCalendarPage
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Kalender
              </Link>
              <Link
                to="/settings"
                className={`flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                  isSettingsPage
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Einstellungen
              </Link>
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3 text-sm text-gray-600 sm:flex-none">
            <div className="flex items-center gap-3">
              <span className="hidden text-gray-500 sm:inline">{user.email}</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-base font-semibold text-blue-600">
                {initials}
              </div>
            </div>
            <Menu
              trigger={
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Hauptmenü öffnen"
                  aria-haspopup="menu"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              }
            >
              <Menu.Item
                icon="📊"
                label="Dashboard"
                onClick={() => navigate('/dashboard')}
              />
              <Menu.Item
                icon="📅"
                label="Kalender"
                onClick={() => navigate('/calendar')}
              />
              <Menu.Item
                icon="⚙️"
                label="Einstellungen"
                onClick={() => navigate('/settings')}
              />
              <Menu.Item
                icon="📦"
                label="Import / Export"
                onClick={() => setShowImportExport(true)}
              />
              <Menu.Item
                icon="🚪"
                label="Logout"
                onClick={handleLogout}
                danger
              />
            </Menu>
          </div>
        </div>
      </header>
      <ImportExportDialog
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        onImportSuccess={handleImportSuccess}
      />
    </>
  );
}

export default Header;
