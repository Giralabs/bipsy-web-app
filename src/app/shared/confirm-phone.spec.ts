import { DialogService } from '../core/dialog.service';
import { confirmPhone } from './confirm-phone';

describe('confirmPhone', () => {
  let asked: { title?: string; message?: string; cancelLabel?: string; confirmLabel?: string } | null;
  const dialog = {
    confirm: (opts: typeof asked) => {
      asked = opts;
      return Promise.resolve(true);
    },
  } as unknown as DialogService;

  beforeEach(() => (asked = null));

  it('parte un número de nueve cifras de tres en tres', async () => {
    await confirmPhone(dialog, '666111222');
    expect(asked!.message!.startsWith('666 111 222\n')).toBeTrue();
  });

  it('normaliza los espacios que ya traiga', async () => {
    await confirmPhone(dialog, ' 612 100 200 ');
    expect(asked!.message!.startsWith('612 100 200\n')).toBeTrue();
  });

  it('deja tal cual un número internacional', async () => {
    await confirmPhone(dialog, '+34 666111222');
    expect(asked!.message!.startsWith('+34 666111222\n')).toBeTrue();
  });

  it('usa los textos de la app y devuelve la respuesta', async () => {
    expect(await confirmPhone(dialog, '666111222')).toBeTrue();
    expect(asked!.title).toBe('¿Es este tu número?');
    expect(asked!.cancelLabel).toBe('Lo reviso');
    expect(asked!.confirmLabel).toBe('Sí, es el mío');
  });
});
