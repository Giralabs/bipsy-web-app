/**
 * Validaciones de formulario que el servidor repite por su cuenta.
 *
 * Están aquí y no dentro de una pantalla porque las usan dos: el alta de cuenta
 * y el formulario de acceso, cuando una cuenta social nueva tiene que dar su
 * teléfono. Dos copias de esta expresión acabarían siendo dos reglas distintas,
 * y la que se nota es siempre la del sitio que no se tocó.
 *
 * ⚠️ Esto no sustituye a la validación del servidor, la adelanta: el fallo se
 * dice al salir del campo en vez de después de rellenar la pantalla entera.
 */

/** Un correo con una forma razonable. Igual que el del alta. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 120;
}

/**
 * Un teléfono que se puede marcar.
 *
 * Se cuentan los dígitos y se ignora todo lo demás: la misma persona escribe
 * «600 11 22 33» o «+34600112233», y el servidor normaliza igual
 * (`business_customer.phone_normalized`). Nueve es lo mínimo en España, y el
 * tope deja sitio al prefijo internacional.
 */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}
