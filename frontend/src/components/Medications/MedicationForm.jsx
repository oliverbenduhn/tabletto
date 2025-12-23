import { forwardRef, useEffect, useState } from 'react';
import Input from '../Common/Input';
import Button from '../Common/Button';

const initialState = {
  name: '',
  dosage_morning: 0,
  dosage_noon: 0,
  dosage_evening: 0,
  current_stock: 0,
  warning_threshold_days: 7
};

const dosagePresets = [0.5, 1, 2];

const MedicationForm = forwardRef(function MedicationForm({ onSubmit, isSubmitting, onSuccess }, ref) {
  const [form, setForm] = useState(initialState);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [error, setError] = useState('');

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]:
        name.includes('dosage') ||
        name.includes('stock') ||
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
    const result = onSubmit({ ...form, photoFile });
    if (result && typeof result.then === 'function') {
      result.then(() => {
        setForm(initialState);
        setPhotoFile(null);
        setPhotoPreview('');
        setPhotoInputKey(prev => prev + 1);
        if (onSuccess) onSuccess();
      });
    } else {
      setForm(initialState);
      setPhotoFile(null);
      setPhotoPreview('');
      setPhotoInputKey(prev => prev + 1);
      if (onSuccess) onSuccess();
    }
  };

  const handlePhotoChange = event => {
    const file = event.target.files?.[0];
    setPhotoFile(file || null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(file ? URL.createObjectURL(file) : '');
  };

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  return (
    <form
      ref={ref}
      className="relative grid gap-4"
      onSubmit={handleSubmit}
    >
      {isSubmitting && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" /> Speichere Eintrag ...
        </div>
      )}
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
      <Input
        label="Aktueller Bestand"
        name="current_stock"
        type="number"
        min="0"
        value={form.current_stock}
        onChange={handleChange}
        helper="Wie viele Tabletten sind aktuell verfügbar?"
      />
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
      <div className="rounded-2xl border border-dashed border-blue-100 bg-blue-50/40 p-4">
        <p className="text-sm font-medium text-gray-800">Foto</p>
        <p className="text-xs text-gray-500">Optional: Bild der Packung hochladen (max. 5 MB).</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            key={photoInputKey}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="text-sm text-gray-600 file:mr-4 file:rounded-full file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-200"
          />
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Vorschau"
              className="h-20 w-20 rounded-xl bg-white object-contain ring-1 ring-blue-100"
            />
          )}
        </div>
      </div>
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
