/**
 * Adds transient stock projections to one persisted medication record.
 *
 * Daily and multi-day schedules are normalized to "dose per interval" so the
 * same calculation can express both. Results depend on the current clock and
 * are intentionally not written back to SQLite.
 *
 * @param {object} medication Persisted medication fields.
 * @returns {object} Derived range, depletion and warning fields.
 */
function calculateMedicationStats(medication) {
  const dailyConsumption = (medication.dosage_morning || 0) + (medication.dosage_noon || 0) + (medication.dosage_evening || 0);
  const intervalDays = medication.interval_days ?? 1;
  const dosagePerInterval = medication.dosage_per_interval ?? dailyConsumption;

  // If no consumption, return infinite
  if (dosagePerInterval === 0) {
    return {
      daily_consumption: 0,
      days_remaining: null,
      depletion_date: null,
      warning_status: 'good',
      last_stock_measured_at: medication.last_stock_measured_at,
      interval_days: intervalDays,
      dosage_per_interval: dosagePerInterval,
      next_due_at: medication.next_due_at
    };
  }

  // Fractional intervals are meaningful because stock and doses may be REAL.
  const intervalsRemaining = medication.current_stock / dosagePerInterval;
  const nextDue = medication.next_due_at ? new Date(medication.next_due_at) : null;
  const now = new Date();
  const daysUntilNextDose = nextDue && !Number.isNaN(nextDue.getTime())
    ? Math.max(0, Math.ceil((nextDue - now) / (1000 * 60 * 60 * 24)))
    : null;
  const daysRemaining = intervalDays > 1 && daysUntilNextDose !== null
    ? daysUntilNextDose + Math.max(0, intervalsRemaining - 1) * intervalDays
    : intervalsRemaining * intervalDays;

  const depletionDate = new Date();
  depletionDate.setDate(depletionDate.getDate() + Math.floor(daysRemaining));

  // The per-medication critical threshold wins before the shared 14-day warning
  // band. Keeping this order prevents a critical stock from being downgraded.
  let warningStatus = 'good';
  if (daysRemaining < 0) {
    warningStatus = 'critical';
  } else if (daysRemaining < medication.warning_threshold_days) {
    warningStatus = 'critical';
  } else if (daysRemaining < 14) {
    warningStatus = 'warning';
  }

  return {
    daily_consumption: dailyConsumption,
    days_remaining: daysRemaining,
    depletion_date: depletionDate.toISOString(),
    warning_status: warningStatus,
    last_stock_measured_at: medication.last_stock_measured_at,
    interval_days: intervalDays,
    dosage_per_interval: dosagePerInterval,
    next_due_at: medication.next_due_at,
    days_until_next_dose: daysUntilNextDose,
    intervals_remaining: intervalsRemaining
  };
}

module.exports = { calculateMedicationStats };
