import { checkPassword, newPasswordError, PASSWORD_MIN_LENGTH } from './password-policy';

describe('password-policy', () => {
  it('pide un mínimo de 8, como StrongPasswordValidator', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(checkPassword('abc1234').hasMinLength).toBeFalse();
    expect(checkPassword('abc12345').hasMinLength).toBeTrue();
  });

  it('cuenta la eñe y las tildes como letras', () => {
    expect(checkPassword('ñññññññ1').hasLetterAndDigit).toBeTrue();
    expect(checkPassword('árbol123').hasLetterAndDigit).toBeTrue();
  });

  it('exige letra Y número', () => {
    expect(checkPassword('soloLetras').hasLetterAndDigit).toBeFalse();
    expect(checkPassword('12345678').hasLetterAndDigit).toBeFalse();
  });

  it('marca las comunes sin mirar mayúsculas', () => {
    expect(checkPassword('Bipsy123').isCommon).toBeTrue();
    expect(checkPassword('QWERTY123').isCommon).toBeTrue();
    expect(checkPassword('Bipsy1234').isCommon).toBeFalse();
  });

  describe('newPasswordError', () => {
    it('vacía → el mensaje de vacío (por defecto o el dado)', () => {
      expect(newPasswordError('')).toBe('Elige una contraseña');
      expect(newPasswordError('', 'Introduce una contraseña nueva')).toBe('Introduce una contraseña nueva');
    });

    it('un error solo y en el orden del servidor', () => {
      expect(newPasswordError('abc')).toBe('Mínimo 8 caracteres');
      expect(newPasswordError('abcdefgh')).toBe('Añade al menos una letra y un número');
      expect(newPasswordError('abc12345')).toBe('Esa contraseña es demasiado común');
    });

    it('una buena pasa', () => {
      expect(newPasswordError('Peluqueria2026')).toBeNull();
    });
  });
});
