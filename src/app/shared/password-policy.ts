/**
 * La política de contraseñas, escrita una sola vez. Port de
 * `GipsiPasswordPolicy` (gipsi_shared_ui) y `password_rules.dart` (app de
 * cliente), con sus textos.
 *
 * **Los valores son los del backend** (`StrongPasswordValidator`): esto existe
 * para decir QUÉ falta mientras se escribe, en vez de dejar que se descubra con
 * un 400 y el formulario ya relleno. Antes estaba copiada a mano en el alta, en
 * recuperar y en Seguridad, y ninguna de las tres miraba la lista de las
 * obvias: «password1» pasaba aquí y la rechazaba el servidor.
 *
 * ⚠️ No vale para el campo de ENTRAR: ahí la contraseña ya existe y puede ser
 * de antes de la regla; rechazarla dejaría a su dueño fuera de su cuenta.
 */

/** `StrongPasswordValidator.MIN_LENGTH`. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Las que bloquea el servidor, copiadas de su `BLOCKLIST`. No es la autoridad:
 * el servidor puede ampliarla, y entonces se enseña su mensaje tal cual.
 */
const BLOCKLIST = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'contrasena',
  'contraseña',
  'qwerty123',
  '11111111',
  '00000000',
  'abc12345',
  'iloveyou',
  'princesa',
  'bipsy123',
  'gipsi123',
  'administrador',
]);

/**
 * Cualquier letra y cualquier dígito, no solo los del alfabeto inglés: el
 * servidor usa `Character.isLetter`, y un `[a-zA-Z]` dejaba fuera la eñe de
 * «contraseña».
 */
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;

export interface PasswordCheck {
  hasMinLength: boolean;
  /** Las dos de la misma regla: lo que hay que hacer es lo mismo. */
  hasLetterAndDigit: boolean;
  isCommon: boolean;
}

export function checkPassword(value: string): PasswordCheck {
  return {
    hasMinLength: value.length >= PASSWORD_MIN_LENGTH,
    hasLetterAndDigit: LETTER.test(value) && DIGIT.test(value),
    isCommon: BLOCKLIST.has(value.toLowerCase()),
  };
}

/**
 * Qué le falta a una contraseña que se ELIGE, o `null` si vale. Uno solo y en
 * el orden del servidor: tres errores a la vez bajo un campo no se leen.
 *
 * [emptyMessage] para quien elige una nueva teniendo ya otra («Introduce una
 * contraseña nueva»); sin él, «Elige una contraseña».
 */
export function newPasswordError(value: string, emptyMessage = 'Elige una contraseña'): string | null {
  if (!value) return emptyMessage;
  const check = checkPassword(value);
  if (!check.hasMinLength) return `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`;
  if (!check.hasLetterAndDigit) return 'Añade al menos una letra y un número';
  if (check.isCommon) return 'Esa contraseña es demasiado común';
  return null;
}
