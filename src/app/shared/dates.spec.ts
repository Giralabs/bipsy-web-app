import { duration, isoDate, isoLocalDateTime, parseLocal, relativeDate } from './dates';

describe('dates', () => {
  describe('parseLocal', () => {
    it('lee un LocalDate como medianoche LOCAL, no UTC', () => {
      const d = parseLocal('2026-09-03');
      expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 3, 0]);
    });

    it('lee un LocalDateTime sin zona en la hora del reloj', () => {
      const d = parseLocal('2026-09-03T10:30:00');
      expect([d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([3, 10, 30, 0]);
    });

    it('acepta minutos sin segundos y el separador espacio', () => {
      expect(parseLocal('2026-09-03T10:30').getMinutes()).toBe(30);
      expect(parseLocal('2026-09-03 10:30:15').getSeconds()).toBe(15);
    });

    it('trunca los microsegundos de Jackson a milisegundos', () => {
      expect(parseLocal('2026-09-03T10:30:00.123456').getMilliseconds()).toBe(123);
      expect(parseLocal('2026-09-03T10:30:00.5').getMilliseconds()).toBe(500);
    });

    it('deja un Instant con Z al navegador, en UTC', () => {
      const d = parseLocal('2026-09-03T10:30:00Z');
      expect(d.toISOString()).toBe('2026-09-03T10:30:00.000Z');
    });

    it('cruza el cambio de hora sin mover la hora del reloj', () => {
      // En Madrid, la madrugada del 25 de octubre de 2026 se atrasa la hora.
      const before = parseLocal('2026-10-24T10:00:00');
      const after = parseLocal('2026-10-26T10:00:00');
      expect(before.getHours()).toBe(10);
      expect(after.getHours()).toBe(10);
      expect(isoDate(after)).toBe('2026-10-26');
    });
  });

  describe('isoDate / isoLocalDateTime', () => {
    it('formatea en local y con ceros', () => {
      expect(isoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });

    it('arma la fecha sin zona que espera el backend', () => {
      expect(isoLocalDateTime(new Date(2026, 2, 9), '9:05')).toBe('2026-03-09T09:05:00');
    });

    it('ida y vuelta con parseLocal', () => {
      const d = parseLocal(isoLocalDateTime(new Date(2026, 6, 1), '18:45'));
      expect([d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([6, 1, 18, 45]);
    });
  });

  describe('relativeDate', () => {
    const offset = (days: number, hour = 12) => {
      const n = new Date();
      return new Date(n.getFullYear(), n.getMonth(), n.getDate() + days, hour);
    };

    it('Hoy, Mañana y Ayer por día de calendario, no por 24 h', () => {
      expect(relativeDate(offset(0, 23))).toBe('Hoy');
      expect(relativeDate(offset(1, 0))).toBe('Mañana');
      expect(relativeDate(offset(-1, 23))).toBe('Ayer');
    });

    it('el día de la semana dentro de la semana próxima, en mayúscula', () => {
      const label = relativeDate(offset(3));
      expect(label[0]).toBe(label[0].toUpperCase());
      expect(label).not.toMatch(/\d/);
    });

    it('fecha corta más allá, sin el punto final de la abreviatura', () => {
      const label = relativeDate(offset(30));
      expect(label).toMatch(/\d/);
      expect(label.endsWith('.')).toBeFalse();
    });
  });

  it('duration', () => {
    expect(duration(45)).toBe('45 min');
    expect(duration(60)).toBe('1 h');
    expect(duration(75)).toBe('1 h 15 min');
  });
});
