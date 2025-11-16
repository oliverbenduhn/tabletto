function calculateMedicationStats(medication) {
  const dailyConsumption = (medication.dosage_morning || 0) + (medication.dosage_evening || 0);

  if (dailyConsumption === 0) {
    return {
      daily_consumption: 0,
      days_remaining: Infinity,
      depletion_date: null,
      warning_status: 'good'
    };
  }

  const daysRemaining = medication.current_stock / dailyConsumption;
  const depletionDate = new Date();
  depletionDate.setDate(depletionDate.getDate() + Math.floor(daysRemaining));

  let warningStatus = 'good';
  if (daysRemaining < medication.warning_threshold_days) {
    warningStatus = 'critical';
  } else if (daysRemaining < 14) {
    warningStatus = 'warning';
  }

  return {
    daily_consumption: dailyConsumption,
    days_remaining: daysRemaining,
    depletion_date: depletionDate.toISOString(),
    warning_status: warningStatus
  };
}

module.exports = { calculateMedicationStats };
