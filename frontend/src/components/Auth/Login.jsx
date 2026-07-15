import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Input from '../Common/Input';
import Button from '../Common/Button';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(form.email, form.password);
      const returnTo = new URLSearchParams(location.search).get('returnTo');
      navigate(returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md rounded-lg bg-white p-8 shadow">
      <h1 className="mb-6 text-2xl font-semibold text-gray-800">Anmelden</h1>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input label="E-Mail" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} required />
        <Input label="Passwort" name="password" type="password" autoComplete="current-password" value={form.password} onChange={handleChange} required />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? 'Bitte warten...' : 'Login'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Noch keinen Account?{' '}
        <Link to="/register" className="inline-flex min-h-11 items-center text-blue-600 hover:underline">
          Registrieren
        </Link>
      </p>
    </div>
  );
}

export default Login;
