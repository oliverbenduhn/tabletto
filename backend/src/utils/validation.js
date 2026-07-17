function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && email.length <= 254 && re.test(email);
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

function validateMedication(data) {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name ist erforderlich');
  } else if (data.name.length > 100) {
    errors.push('Name darf maximal 100 Zeichen lang sein');
  }

  if (!isFiniteNumber(data.dosage_morning) || data.dosage_morning < 0 || data.dosage_morning > 10) {
    errors.push('Morgens-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (!isFiniteNumber(data.dosage_noon) || data.dosage_noon < 0 || data.dosage_noon > 10) {
    errors.push('Mittags-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (!isFiniteNumber(data.dosage_evening) || data.dosage_evening < 0 || data.dosage_evening > 10) {
    errors.push('Abends-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (data.tablets_per_package !== undefined && data.tablets_per_package !== null) {
    if (!Number.isInteger(data.tablets_per_package) || data.tablets_per_package < 0 || data.tablets_per_package > 1000) {
      errors.push('Tabletten pro Packung muss zwischen 0 und 1000 liegen');
    }
  }

  if (!isFiniteNumber(data.current_stock) || data.current_stock < 0 || data.current_stock > 10000) {
    errors.push('Aktueller Bestand muss zwischen 0 und 10000 liegen');
  }

  if (!Number.isInteger(data.warning_threshold_days) || data.warning_threshold_days < 1 || data.warning_threshold_days > 30) {
    errors.push('Warngrenze muss zwischen 1 und 30 Tagen liegen');
  }

  if (!Number.isInteger(data.interval_days) || data.interval_days < 1 || data.interval_days > 365) {
    errors.push('Einnahmeintervall muss zwischen 1 und 365 Tagen liegen');
  }

  if (!isFiniteNumber(data.dosage_per_interval) || data.dosage_per_interval < 0 || data.dosage_per_interval > 30) {
    errors.push('Dosierung pro Intervall muss zwischen 0 und 30 liegen');
  }

  if (data.interval_days > 1 && !data.next_due_at) {
    errors.push('Nächste Einnahme ist für Intervallmedikamente erforderlich');
  }

  // Validate next_due_at if provided
  if (data.next_due_at !== undefined && data.next_due_at !== null) {
    const dateError = validateNextDueAt(data.next_due_at);
    if (dateError) {
      errors.push(dateError);
    }
  }

  return errors;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateNextDueAt(dateString) {
  if (!dateString) {
    return null; // Optional field
  }

  const date = new Date(dateString);

  // Check if valid date
  if (isNaN(date.getTime())) {
    return 'Nächste Einnahme muss ein gültiges Datum sein';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) {
    return 'Nächste Einnahme darf nicht in der Vergangenheit liegen';
  }

  // Check if date is not too far in the future (e.g., max 2 years)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 2);

  if (date > maxDate) {
    return 'Nächste Einnahme darf nicht mehr als 2 Jahre in der Zukunft liegen';
  }

  return null;
}

module.exports = { validateEmail, validatePassword, validateMedication, validateNextDueAt };
