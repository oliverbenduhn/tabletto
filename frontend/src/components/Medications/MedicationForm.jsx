import { forwardRef, useEffect, useState } from 'react';
import Input from '../Common/Input';
import Button from '../Common/Button';

const initialState = {
  name: '',
  dosage_morning: 0,
  dosage_noon: 0,
  dosage_evening: 0,
  dosage_per_interval: 0,
  tablets_per_package: 0,
  current_stock: 0,
  warning_threshold_days: 7,
  interval_days: 1,
  next_due_at: ''
};

const dosagePresets = [0.5, 1, 2];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MedicationForm = forwardRef(function MedicationForm({ onSubmit, isSubmitting, onSuccess, initialData = null, isEditMode = false }, ref) {
  const [form, setForm] = useState(initialState);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [error, setError] = useState('');

  const handleChange = e => {
    const { name, value } = e.target;

    if (name === 'interval_days') {
      const intervalDays = Number(value);
      setForm(prev => {
        if (intervalDays === 1) {
          return { ...prev, interval_days: 1, next_due_at: '' };
        }
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + intervalDays);
        return {
          ...prev,
          interval_days: intervalDays,
          dosage_per_interval: prev.dosage_per_interval || prev.dosage_morning + prev.dosage_noon + prev.dosage_evening,
          next_due_at: prev.next_due_at || localDateString(dueDate)
        };
      });
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
    if (form.interval_days > 1 && !form.next_due_at) {
      setError('Nächste Einnahme ist erforderlich');
      return;
    }
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
      dosage_per_interval: form.interval_days === 1
        ? form.dosage_morning + form.dosage_noon + form.dosage_evening
        : form.dosage_per_interval,
      next_due_at: form.interval_days > 1 && form.next_due_at
        ? `${form.next_due_at}T12:00:00`
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
        ? String(initialData.next_due_at).slice(0, 10)
        : '';

      setForm({
        name: initialData.name || '',
        dosage_morning: initialData.dosage_morning || 0,
        dosage_noon: initialData.dosage_noon || 0,
        dosage_evening: initialData.dosage_evening || 0,
        dosage_per_interval: initialData.dosage_per_interval || 0,
        tablets_per_package: initialData.tablets_per_package || 0,
        current_stock: initialData.current_stock || 0,
        warning_threshold_days: initialData.warning_threshold_days || 7,
        interval_days: initialData.interval_days || 1,
        next_due_at: nextDueDate
      });
    }
  }, [initialData, isEditMode]);

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
      {form.interval_days === 1 && <div className="grid gap-4 sm:grid-cols-3">
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
      </div>}
      {form.interval_days === 1 && <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-600">Schnellwahl:</span>
        {dosagePresets.map(preset => (
          <button
            type="button"
            key={preset}
            onClick={() => applyPreset(preset)}
            className="min-h-11 rounded-full border border-blue-100 px-3 py-2 text-blue-600 transition hover:bg-blue-50"
          >
            {preset} Tabletten
          </button>
        ))}
      </div>}
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
              className="min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            <Input
              label="Dosierung pro Einnahme"
              name="dosage_per_interval"
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={form.dosage_per_interval}
              onChange={handleChange}
              required
            />
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nächste Einnahme
            </label>
            <input
              type="date"
              name="next_due_at"
              value={form.next_due_at}
              onChange={handleChange}
              min={localDateString()}
              required
              className="min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            <p className="mt-1 text-xs text-gray-500">
              Das Datum, an dem die nächste Einnahme fällig ist. Der Bestand wird automatisch am fälligen Datum reduziert.
            </p>
          </div>
        )}
      </div>
      <Input
        label="Tabletten/Dosen pro Packung"
        name="tablets_per_package"
        type="number"
        min="0"
        max="1000"
        step="1"
        value={form.tablets_per_package}
        onChange={handleChange}
        helper="Wird als Standardmenge beim Hinzufügen einer Packung verwendet."
      />
      {!isEditMode && <Input
        label="Aktueller Bestand"
        name="current_stock"
        type="number"
        min="0"
        value={form.current_stock}
        onChange={handleChange}
        helper="Wie viele Tabletten/Dosen sind aktuell verfügbar?"
      />}
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
      {!isEditMode && <div className="rounded-2xl border border-dashed border-blue-100 bg-blue-50/40 p-4">
        <p className="text-sm font-medium text-gray-800">Foto</p>
        <p className="text-xs text-gray-500">Optional: Bild der Packung hochladen (max. 5 MB).</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            key={photoInputKey}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="min-h-11 text-sm text-gray-600 file:mr-4 file:min-h-11 file:rounded-full file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-200"
          />
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Vorschau"
              className="h-20 w-20 rounded-xl bg-white object-contain ring-1 ring-blue-100"
            />
          )}
        </div>
      </div>}
      {error && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-24 mt-2 border-t border-gray-100 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0">
      <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Speichern ...
          </span>
        ) : (
          'Speichern'
        )}
      </Button>
      </div>
    </form>
  );
});

export default MedicationForm;
