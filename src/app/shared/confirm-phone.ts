import { DialogService } from '../core/dialog.service';

/**
 * La confirmación del teléfono antes de guardarlo. Port de `confirm_phone.dart`.
 *
 * Un número mal escrito no lo descubre nadie: la cuenta se crea igual, la
 * reserva se hace igual, y el fallo aparece el día que el negocio necesita
 * avisar de algo y llama a un número que no existe. Releerlo con los dígitos
 * separados —que es como se ve el que sobra— cuesta un clic y ahorra esa
 * llamada perdida.
 *
 * Resuelve `true` si lo confirma.
 */
export function confirmPhone(dialog: DialogService, phone: string): Promise<boolean> {
  return dialog.confirm({
    title: '¿Es este tu número?',
    message:
      `${spaced(phone)}\n\n` +
      'Es el número por el que te llamará el negocio si hay algún cambio con tu cita. ' +
      'Compruébalo antes de guardarlo.',
    cancelLabel: 'Lo reviso',
    confirmLabel: 'Sí, es el mío',
  });
}

/**
 * De tres en tres, para leerlo dígito a dígito: «666111222» de corrido se lee
 * de memoria y un número mal escrito pasa el repaso. Solo los de nueve cifras;
 * un internacional se deja tal cual antes que partirlo por donde no toca.
 */
function spaced(phone: string): string {
  const clean = phone.replace(/\s+/g, '');
  if (!/^\d{9}$/.test(clean)) return phone.trim();
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
}
