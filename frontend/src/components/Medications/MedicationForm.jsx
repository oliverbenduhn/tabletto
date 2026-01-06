import { forwardRef, useEffect, useState } from 'react';
import Input from '../Common/Input';
import Button from '../Common/Button';

const initialState = {
  name: '',
  dosage_morning: 0,
  dosage_noon: 0,
  dosage_evening: 0,
  current_stock: 0,
  warning_threshold_days: 7,
  interval_days: 1,
  next_due_at: ''
};

const dosagePresets = [0.5, 1, 2];

const MedicationForm = forwardRef(function MedicationForm({ onSubmit, isSubmitting, onSuccess, initialData = null, isEditMode = false }, ref) {
  const [form, setForm] = useState(initialState);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [error, setError] = useState('');

  const handleChange = e => {
    const { name, value } = e.target;

    // Special handling for interval_days: clear next_due_at when switching to daily
    if (name === 'interval_days' && Number(value) === 1) {
      setForm(prev => ({
        ...prev,
        interval_days: 1,
        next_due_at: ''
      }));
      return;
    }

    setForm(prev => ({
      ...prev,
      [name]:
        name.includes('dosage') ||
        name.includes('stock') ||
        name.includes('warning') ||
        name === 'interval_days'
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

    // Validate next_due_at for interval medications
    if (form.interval_days > 1 && form.next_due_at) {
      const selectedDate = new Date(form.next_due_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        setError('Nächste Einnahme darf nicht in der Vergangenheit liegen');
        return;
      }
    }

    // Submit with next_due_at as ISO string (or null for daily meds)
    const submitData = {
      ...form,
      next_due_at: form.interval_days > 1 && form.next_due_at
        ? new Date(form.next_due_at).toISOString()
        : null
    };

    // In edit mode, don't send photoFile
    const result = onSubmit(isEditMode ? submitData : { ...submitData, photoFile });
    if (result && typeof result.then === 'function') {
      result.then(() => {
        if (!isEditMode) {
          setForm(initialState);
          setPhotoFile(null);
          setPhotoPreview('');
          setPhotoInputKey(prev => prev + 1);
        }
        if (onSuccess) onSuccess();
      });
    } else {
      if (!isEditMode) {
        setForm(initialState);
        setPhotoFile(null);
        setPhotoPreview('');
        setPhotoInputKey(prev => prev + 1);
      }
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

  // Load initial data for edit mode
  useEffect(() => {
    if (initialData && isEditMode) {
      // Convert next_due_at from ISO to YYYY-MM-DD format for date input
      const nextDueDate = initialData.next_due_at
        ? new Date(initialData.next_due_at).toISOString().split('T')[0]
        : '';

      setForm({
        name: initialData.name || '',
        dosage_morning: initialData.dosage_morning || 0,
        dosage_noon: initialData.dosage_noon || 0,
        dosage_evening: initialData.dosage_evening || 0,
        current_stock: initialData.current_stock || 0,
        warning_threshold_days: initialData.warning_threshold_days || 7,
        interval_days: initialData.interval_days || 1,
        next_due_at: nextDueDate
      });
    }
  }, [initialData, isEditMode]);

  // Auto-calculate next_due_at when interval_days changes (only for new medications)
  useEffect(() => {
    if (!isEditMode && form.interval_days > 1 && !form.next_due_at) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + form.interval_days);
      const dateString = futureDate.toISOString().split('T')[0];
      setForm(prev => ({ ...prev, next_due_at: dateString }));
    }
  }, [form.interval_days, isEditMode, form.next_due_at]);

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
      <div className="rounded-2xl border border-dashed border-purple-100 bg-purple-50/40 p-4">
        <p className="text-sm font-medium text-gray-800">Einnahme-Intervall</p>
        <p className="text-xs text-gray-500 mb-3">Wie oft wird das Medikament genommen?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Intervall</label>
            <select
              name="interval_days"
              value={form.interval_days}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="1">Täglich</option>
              <option value="2">Alle 2 Tage</option>
              <option value="3">Alle 3 Tage</option>
              <option value="7">Wöchentlich (7 Tage)</option>
              <option value="14">Alle 2 Wochen (14 Tage)</option>
              <option value="30">Monatlich (30 Tage)</option>
              <option value="90">Alle 3 Monate (90 Tage)</option>
            </select>
          </div>
          <div className="flex items-center text-xs text-gray-600">
            {form.interval_days === 1 ? (
              <span>✓ Dosierung wird täglich automatisch abgezogen</span>
            ) : (
              <span>✓ Dosierung wird alle {form.interval_days} Tage abgezogen</span>
            )}
          </div>
        </div>
        {form.interval_days > 1 && (
          <div className="mt-3 rounded-xl border border-purple-200 bg-white p-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nächste Einnahme
            </label>
            <input
              type="date"
              name="next_due_at"
              value={form.next_due_at}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            <p className="mt-1 text-xs text-gray-500">
              Das Datum, an dem die nächste Einnahme fällig ist. Der Bestand wird automatisch am fälligen Datum reduziert.
            </p>
          </div>
        )}
      </div>
      <Input
        label="Aktueller Bestand"
        name="current_stock"
        type="number"
        min="0"
        value={form.current_stock}
        onChange={handleChange}
        helper="Wie viele Tabletten/Dosen sind aktuell verfügbar?"
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
