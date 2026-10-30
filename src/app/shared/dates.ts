/**
 * Fechas y horas en castellano. Port de `GipsiFormat` y del `_formatDate` de
 * `BookingCard`.
 *
 * Se usa `Intl` del navegador en vez de una tabla escrita a mano: los nombres
 * de días y meses ya están ahí y no hay que mantenerlos.
 */

const DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });
const SHORT = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const LONG = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const TIME = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

/**
 * El backend manda la fecha de una cita **sin zona** (`2026-09-03T10:30:00`).
 * `new Date(...)` la interpreta como local, que es justo lo que queremos: la
 * cita es a las 10:30 en el reloj del negocio, no en UTC.
 *
 * Se trocea a mano en vez de pasarla a `new Date(...)` tal cual por dos
 * trampas del parser del navegador: una fecha SOLA (`2026-09-03`, un
 * `LocalDate`) la lee como medianoche UTC —el día anterior al oeste de
 * Greenwich—, y Safari da `Invalid Date` con más de tres decimales en los
 * segundos, que es lo que manda Jackson con microsegundos. Lo que lleva zona
 * (`…Z`, un `Instant`) sí va al navegador: ahí la UTC es lo correcto.
 */
const LOCAL_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/;

export function parseLocal(value: string): Date {
  const m = LOCAL_ISO.exec(value);
  if (!m) {
    return new Date(value);
  }
  const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), ms);
}

/** Formato relativo amable: "Hoy", "Mañana", "Mar 28 abr". */
export function relativeDate(when: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff <= 7) return capitalize(DAY.format(when));
  return capitalize(SHORT.format(when).replace(/\.$/, ''));
}

/** "Miércoles, 3 de septiembre". Para cabeceras de detalle. */
export function longDate(when: Date): string {
  return capitalize(LONG.format(when));
}

/** "10:30". */
export function time(when: Date): string {
  return TIME.format(when);
}

/** `yyyy-MM-dd` en hora local: es lo que espera el endpoint de disponibilidad. */
export function isoDate(when: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

/**
 * ISO-8601 **sin zona** ni offset, como espera el backend al reservar.
 * Mandar el instante en UTC desplazaría la cita en la agenda del negocio.
 */
export function isoLocalDateTime(day: Date, hhmm: string): string {
  const [hour, minute] = hhmm.split(':');
  return `${isoDate(day)}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
}

export function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

/** Precio en euros, con la coma decimal del castellano. */
export function euros(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

/** "45 min" o "1 h 15 min". */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
