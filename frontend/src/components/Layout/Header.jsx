import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

function Header() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    api.logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <Link to="/dashboard" className="text-xl font-semibold text-blue-600">
        Medikamentenverwaltung
      </Link>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>{user.email}</span>
        <button onClick={handleLogout} className="text-red-600 hover:underline">
          Logout
        </button>
      </div>
    </header>
  );
}

export default Header;
