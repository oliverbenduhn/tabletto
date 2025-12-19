import { forwardRef, useState } from 'react';
import Input from '../Common/Input';
import Button from '../Common/Button';

const initialState = {
  name: '',
  dosage_morning: 0,
  dosage_noon: 0,
  dosage_evening: 0,
  tablets_per_package: 0,
  current_stock: 0,
  warning_threshold_days: 7
};

const dosagePresets = [0.5, 1, 2];

const MedicationForm = forwardRef(function MedicationForm({ onSubmit, isSubmitting }, ref) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]:
        name.includes('dosage') ||
        name.includes('stock') ||
        name.includes('tablets') ||
        name.includes('warning')
          ? Number(value)
          : value
    }));
  };

  const applyPreset = preset => {
    setForm(prev => ({ ...prev, dosage_morning: preset, dosage_noon: preset, dosage_evening: preset }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Name ist erforderlich');
      return;
    }
    const result = onSubmit(form);
    if (result && typeof result.then === 'function') {
      result.then(() => setForm(initialState));
    } else {
      setForm(initialState);
    }
  };

  return (
    <form
      ref={ref}
      className="relative grid gap-4 rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm"
      onSubmit={handleSubmit}
    >
      {isSubmitting && (
        <div className="pointer-events-none absolute inset-x-5 top-5 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" /> Speichere Eintrag ...
        </div>
      )}
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Neue Eintragung</p>
        <h2 className="text-xl font-semibold text-gray-900">Medikament hinzufügen</h2>
        <p className="text-sm text-gray-500">Pflege Bestand, Dosierungen und Warngrenzen an einem Ort.</p>
      </div>
      <Input
        label="Name"
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="z. B. Ibuprofen 600"
        required
      />
      <div className="grid gap-4 sm:grid-cols-3">
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
          label="Dosierung mittags"
          name="dosage_noon"
          type="number"
          min="0"
          step="0.5"
          value={form.dosage_noon}
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
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-600">Schnellwahl:</span>
        {dosagePresets.map(preset => (
          <button
            type="button"
            key={preset}
            onClick={() => applyPreset(preset)}
            className="rounded-full border border-blue-100 px-3 py-1 text-blue-600 transition hover:bg-blue-50"
          >
            {preset} Tabletten
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Tabletten pro Packung"
          name="tablets_per_package"
          type="number"
          min="1"
          value={form.tablets_per_package}
          onChange={handleChange}
          helper="z. B. 20, 50 oder 100"
        />
        <Input
          label="Aktueller Bestand"
          name="current_stock"
          type="number"
          min="0"
          value={form.current_stock}
          onChange={handleChange}
          helper="Wie viele Tabletten sind aktuell verfügbar?"
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
      <Button type="submit" disabled={isSubmitting} className="justify-center">
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Speichern ...
          </span>
        ) : (
          'Speichern'
        )}
      </Button>
    </form>
  );
});

export default MedicationForm;
