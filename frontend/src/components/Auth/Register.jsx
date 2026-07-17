import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Input from '../Common/Input';
import Button from '../Common/Button';

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.register(form.email, form.password);
      setSuccess('Registrierung erfolgreich. Bitte anmelden.');
      setTimeout(() => navigate('/login'), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md rounded-lg bg-white p-8 shadow">
      <h1 className="mb-6 text-2xl font-semibold text-gray-800">Registrieren</h1>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input label="E-Mail" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} required />
        <Input label="Passwort" name="password" type="password" autoComplete="new-password" minLength="8" helper="Mindestens 8 Zeichen" value={form.password} onChange={handleChange} required />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="text-sm text-green-700">{success}</p>}
        <Button type="submit" disabled={loading || Boolean(success)}>{loading ? 'Account wird erstellt …' : 'Account erstellen'}</Button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Bereits registriert?{' '}
        <Link to="/login" className="inline-flex min-h-11 items-center text-blue-600 hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}

export default Register;
