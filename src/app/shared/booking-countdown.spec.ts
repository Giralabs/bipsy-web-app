import { bookingCountdown } from './booking-countdown';

describe('bookingCountdown', () => {
  // Fechas en hora local: es como llegan de parseLocal.
  const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

  it('jueves 22:32 → sábado 09:30 son 2 días, no «Es mañana»', () => {
    // 35 h: redondeando por horas salía «mañana».
    expect(bookingCountdown(at(2026, 10, 31, 9, 30), at(2026, 10, 29, 22, 32))).toBe('Faltan 2 días');
  });

  it('«Es mañana» solo si es el día siguiente de calendario', () => {
    // Lunes 00:30 → martes 11:30: 35 h y sí es mañana.
    expect(bookingCountdown(at(2026, 11, 3, 11, 30), at(2026, 11, 2, 0, 30))).toBe('Es mañana');
    // Mismas 35 h empezando tarde: ya es pasado mañana.
    expect(bookingCountdown(at(2026, 11, 4, 10, 0), at(2026, 11, 2, 23, 0))).toBe('Faltan 2 días');
  });

  it('menos de una hora: minutos, y nunca negativos', () => {
    const now = at(2026, 11, 2, 10, 0);
    expect(bookingCountdown(at(2026, 11, 2, 10, 20), now)).toBe('Empieza en 20 min');
    expect(bookingCountdown(at(2026, 11, 2, 10, 59), now)).toBe('Empieza en 59 min');
    expect(bookingCountdown(at(2026, 11, 2, 9, 50), now)).toBe('Empieza en 0 min');
  });

  it('menos de un día: horas', () => {
    const now = at(2026, 11, 2, 10, 0);
    expect(bookingCountdown(at(2026, 11, 2, 11, 0), now)).toBe('Faltan 1 h');
    expect(bookingCountdown(at(2026, 11, 2, 15, 0), now)).toBe('Faltan 5 h');
    expect(bookingCountdown(at(2026, 11, 3, 9, 0), now)).toBe('Faltan 23 h');
  });

  it('cruza el cambio de hora del 25-oct-2026 contando días de calendario', () => {
    // Sábado 24 10:00 → lunes 26 10:00: 49 h reales en Madrid, 2 días en el reloj.
    expect(bookingCountdown(at(2026, 10, 26, 10), at(2026, 10, 24, 10))).toBe('Faltan 2 días');
    // Sábado 24 10:00 → domingo 25 18:00: el día de 25 h sigue siendo «mañana».
    expect(bookingCountdown(at(2026, 10, 25, 18), at(2026, 10, 24, 10))).toBe('Es mañana');
  });

  it('en Europe/Madrid, las horas del día del cambio son horas reales', () => {
    if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Europe/Madrid') {
      pending('Solo se puede comprobar con el navegador en hora de Madrid');
      return;
    }
    // Domingo 25 01:00 → 23:00: 22 h de reloj, 23 h reales (la de las 3 se repite).
    expect(bookingCountdown(at(2026, 10, 25, 23), at(2026, 10, 25, 1))).toBe('Faltan 23 h');
  });
});
