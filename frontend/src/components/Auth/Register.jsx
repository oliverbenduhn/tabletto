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

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.register(form.email, form.password);
      setSuccess('Registrierung erfolgreich. Bitte anmelden.');
      setTimeout(() => navigate('/login'), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md rounded-lg bg-white p-8 shadow">
      <h1 className="mb-6 text-2xl font-semibold text-gray-800">Registrieren</h1>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input label="E-Mail" name="email" type="email" value={form.email} onChange={handleChange} required />
        <Input label="Passwort" name="password" type="password" value={form.password} onChange={handleChange} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <Button type="submit">Account erstellen</Button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Bereits registriert?{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}

export default Register;
