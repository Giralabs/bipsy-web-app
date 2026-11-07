import { SocialIdentity, missingProfile, withoutFormEncodedSpaces } from './social-auth.service';
import { awaitingConfirm } from './confirm-request-gate.service';

describe('withoutFormEncodedSpaces', () => {
  it('devuelve los espacios que Apple manda como «+»', () => {
    expect(withoutFormEncodedSpaces('Jose+Manuel+Jimenez')).toBe('Jose Manuel Jimenez');
  });

  it('limpia espacios de más y deja null si no queda nada', () => {
    expect(withoutFormEncodedSpaces('  Ana   María ')).toBe('Ana María');
    expect(withoutFormEncodedSpaces('+')).toBeNull();
    expect(withoutFormEncodedSpaces(null)).toBeNull();
  });
});

describe('missingProfile', () => {
  const identity = (name: string | null): SocialIdentity => ({
    provider: 'apple',
    idToken: 't',
    email: null,
    name,
  });

  it('con sesión no falta nada', () => {
    expect(missingProfile({ needsProfile: false }, identity(null))).toBeNull();
  });

  it('sin correo pide el correo, y el nombre solo si nadie lo tiene', () => {
    expect(missingProfile({ needsProfile: true }, identity('Ana'))).toEqual({ email: true, name: false });
    expect(missingProfile({ needsProfile: true, name: 'Ana' }, identity(null))).toEqual({ email: true, name: false });
    expect(missingProfile({ needsProfile: true }, identity(null))).toEqual({ email: true, name: true });
  });

  it('con correo, lo que falta es el nombre', () => {
    expect(missingProfile({ needsProfile: true, email: 'a@b.es' }, identity(null))).toEqual({ email: false, name: true });
  });
});

describe('awaitingConfirm', () => {
  const now = Date.UTC(2026, 10, 7, 12, 0, 0);
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

  it('solo las que esperan respuesta y siguen en plazo, la que antes caduca primero', () => {
    const list = [
      { id: 1, status: 'AWAITING_CUSTOMER', confirmExpiresAt: at(9) },
      { id: 2, status: 'CONFIRMED', confirmExpiresAt: at(3) },
      { id: 3, status: 'AWAITING_CUSTOMER', confirmExpiresAt: at(-1) },
      { id: 4, status: 'AWAITING_CUSTOMER', confirmExpiresAt: at(2) },
      { id: 5, status: 'AWAITING_CUSTOMER', confirmExpiresAt: null },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(awaitingConfirm(list as any, now).map(b => b.id)).toEqual([4, 1]);
  });
});
