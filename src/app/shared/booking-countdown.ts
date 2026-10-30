/**
 * Cuánto falta para una cita: «Empieza en 20 min», «Faltan 5 h», «Es mañana»,
 * «Faltan 3 días».
 *
 * Por debajo de un día cuenta horas; por encima, **días de calendario** y no
 * horas redondeadas: el jueves a las 22:00 una cita del sábado a las 9:30 está
 * a 35 h, que redondeando salía «Es mañana».
 *
 * Mis citas y el detalle de la cita lo calculaban cada uno a su manera y
 * decían cosas distintas de la misma cita.
 */
export function bookingCountdown(start: Date, now: Date = new Date()): string {
  const minutes = Math.round((start.getTime() - now.getTime()) / 60_000);
  if (minutes < 60) return `Empieza en ${Math.max(minutes, 0)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Faltan ${hours} h`;
  const days = Math.round((midnight(start) - midnight(now)) / 86_400_000);
  return days === 1 ? 'Es mañana' : `Faltan ${days} días`;
}

/** Medianoche local. `Math.round` en la resta absorbe el día de 23 o 25 h. */
function midnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
