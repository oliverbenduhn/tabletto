function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  return Boolean(password && password.length >= 8);
}

function validateMedication(data) {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name ist erforderlich');
  } else if (data.name.length > 100) {
    errors.push('Name darf maximal 100 Zeichen lang sein');
  }

  if (data.dosage_morning < 0 || data.dosage_morning > 10) {
    errors.push('Morgens-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (data.dosage_evening < 0 || data.dosage_evening > 10) {
    errors.push('Abends-Dosierung muss zwischen 0 und 10 liegen');
  }

  if (data.tablets_per_package <= 0 || data.tablets_per_package > 1000) {
    errors.push('Tabletten pro Packung muss zwischen 1 und 1000 liegen');
  }

  if (data.current_stock < 0 || data.current_stock > 10000) {
    errors.push('Aktueller Bestand muss zwischen 0 und 10000 liegen');
  }

  if (data.warning_threshold_days < 1 || data.warning_threshold_days > 30) {
    errors.push('Warngrenze muss zwischen 1 und 30 Tagen liegen');
  }

  return errors;
}

module.exports = { validateEmail, validatePassword, validateMedication };
