import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

function Header() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    api.logout();
    navigate('/login');
  };

  const initials = user.email ? user.email.charAt(0).toUpperCase() : '?';

  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link to="/dashboard" className="text-xl font-semibold text-blue-600">
          Tabletto
        </Link>
        <div className="flex flex-1 items-center justify-end gap-3 text-sm text-gray-600 sm:flex-none">
          <div className="flex items-center gap-3">
            <span className="hidden text-gray-500 sm:inline">{user.email}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-base font-semibold text-blue-600">
              {initials}
            </div>
          </div>
          <button onClick={handleLogout} className="text-red-500 transition hover:text-red-600">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
