import { ScheduleDayResponse } from '../../models/bipsy.models';
import { opensIn } from './search.component';

describe('opensIn (filtro de franja de Buscar)', () => {
  const day = (dayOfWeek: string, startTime?: string, endTime?: string): ScheduleDayResponse =>
    ({ dayOfWeek, startTime, endTime });

  const partido = [day('MONDAY', '09:00:00', '14:00:00'), day('MONDAY', '17:00:00', '21:00:00')];
  const soloTarde = [day('TUESDAY', '15:00:00', '20:00:00')];
  const soloMañana = [day('WEDNESDAY', '08:00:00', '13:30:00')];

  it('mañana: algún tramo empieza antes de las 14:00', () => {
    expect(opensIn(partido, 'morning', null)).toBeTrue();
    expect(opensIn(soloMañana, 'morning', null)).toBeTrue();
    expect(opensIn(soloTarde, 'morning', null)).toBeFalse();
  });

  it('tarde: algún tramo pisa 14:00–20:00', () => {
    expect(opensIn(partido, 'afternoon', null)).toBeTrue();
    expect(opensIn(soloTarde, 'afternoon', null)).toBeTrue();
    expect(opensIn(soloMañana, 'afternoon', null)).toBeFalse();
    // Cierra justo a las 14:00: no pisa la tarde.
    expect(opensIn([day('MONDAY', '09:00:00', '14:00:00')], 'afternoon', null)).toBeFalse();
    // Abre a las 20:00: ya no es tarde.
    expect(opensIn([day('MONDAY', '20:00:00', '23:00:00')], 'afternoon', null)).toBeFalse();
  });

  it('con día elegido solo cuenta ese día', () => {
    expect(opensIn(soloTarde, 'afternoon', 'TUESDAY')).toBeTrue();
    expect(opensIn(soloTarde, 'afternoon', 'MONDAY')).toBeFalse();
  });

  it('ignora tramos sin horas', () => {
    expect(opensIn([day('MONDAY')], 'morning', null)).toBeFalse();
  });

  it('acepta horas sin segundos', () => {
    expect(opensIn([day('MONDAY', '10:00', '12:00')], 'morning', null)).toBeTrue();
  });
});
