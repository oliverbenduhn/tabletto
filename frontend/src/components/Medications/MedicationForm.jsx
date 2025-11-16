import { useState } from 'react';
import Input from '../Common/Input';
import Button from '../Common/Button';

const initialState = {
  name: '',
  dosage_morning: 0,
  dosage_evening: 0,
  tablets_per_package: 0,
  current_stock: 0,
  warning_threshold_days: 7
};

function MedicationForm({ onSubmit }) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name.includes('dosage') || name.includes('stock') || name.includes('tablets') || name.includes('warning') ? Number(value) : value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Name ist erforderlich');
      return;
    }
    onSubmit(form);
    setForm(initialState);
  };

  return (
    <form className="grid gap-4 rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm" onSubmit={handleSubmit}>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Neue Eintragung</p>
        <h2 className="text-xl font-semibold text-gray-900">Medikament hinzufügen</h2>
      </div>
      <Input
        label="Name"
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="z. B. Ibuprofen 600"
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Dosierung morgens"
          name="dosage_morning"
          type="number"
          min="0"
          step="0.5"
          value={form.dosage_morning}
          onChange={handleChange}
        />
        <Input
          label="Dosierung abends"
          name="dosage_evening"
          type="number"
          min="0"
          step="0.5"
          value={form.dosage_evening}
          onChange={handleChange}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Tabletten pro Packung"
          name="tablets_per_package"
          type="number"
          min="1"
          value={form.tablets_per_package}
          onChange={handleChange}
        />
        <Input
          label="Aktueller Bestand"
          name="current_stock"
          type="number"
          min="0"
          value={form.current_stock}
          onChange={handleChange}
        />
      </div>
      <Input
        label="Warngrenze (Tage)"
        name="warning_threshold_days"
        type="number"
        min="1"
        max="30"
        value={form.warning_threshold_days}
        onChange={handleChange}
        helper="Wir benachrichtigen dich, wenn der Bestand unter diese Grenze fällt."
      />
      {error && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
      <Button type="submit">Speichern</Button>
    </form>
  );
}

export default MedicationForm;
