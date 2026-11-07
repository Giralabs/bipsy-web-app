import { TestBed } from '@angular/core/testing';
import { LocationService, deniedHelp, distanceKm, parseGeoResponse, parseStoredFix } from './location.service';

describe('parseGeoResponse', () => {
  it('lee lo que devuelve /api/geo', () => {
    expect(parseGeoResponse({ lat: 40.4168, lng: -3.7038, city: 'Madrid', country: 'ES' }))
      .toEqual({ lat: 40.4168, lng: -3.7038, city: 'Madrid', country: 'ES' });
  });

  it('acepta números en texto y ciudad vacía como null', () => {
    expect(parseGeoResponse({ lat: '37.39', lng: '-5.98', city: ' ', country: null }))
      .toEqual({ lat: 37.39, lng: -5.98, city: null, country: null });
  });

  it('sin punto válido no hay ubicación (local, VPN, IP sin situar)', () => {
    expect(parseGeoResponse({ lat: null, lng: null, city: null, country: null })).toBeNull();
    expect(parseGeoResponse({ lat: 0, lng: 0 })).toBeNull();
    expect(parseGeoResponse({ lat: 200, lng: 3 })).toBeNull();
    expect(parseGeoResponse('<!doctype html>')).toBeNull();
    expect(parseGeoResponse(null)).toBeNull();
  });
});

describe('LocationService al entrar', () => {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

  let state: PermissionState;
  let geo: jasmine.Spy;

  beforeEach(() => {
    try { localStorage.removeItem('bipsy.location.last'); } catch { /* sin almacenamiento */ }
    spyOn(navigator.permissions, 'query').and.callFake(() =>
      Promise.resolve({ state, addEventListener: () => undefined } as unknown as PermissionStatus));
    geo = spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(success =>
      success({ coords: { latitude: 37.3891, longitude: -5.9845 } } as GeolocationPosition));
    spyOn(window, 'fetch').and.callFake(() =>
      Promise.resolve(json({ lat: 40.4168, lng: -3.7038, city: 'Madrid', country: 'ES' })));
  });

  async function started(): Promise<LocationService> {
    TestBed.resetTestingModule();
    const service = TestBed.inject(LocationService);
    service.start();
    // Deja correr las promesas del permiso y de la petición.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve));
    return service;
  }

  it('sin permiso decidido NO pregunta: usa la de la IP y la presenta como ciudad', async () => {
    state = 'prompt';
    const service = await started();
    expect(geo).not.toHaveBeenCalled();
    expect(service.coords()).toEqual({ lat: 40.4168, lng: -3.7038 });
    expect(service.precise()).toBeFalse();
    expect(service.approxCity()).toBe('Madrid');
  });

  it('con el permiso ya concedido usa la precisa en silencio, y gana a la de la IP', async () => {
    state = 'granted';
    const service = await started();
    expect(geo).toHaveBeenCalled();
    expect(service.coords()).toEqual({ lat: 37.3891, lng: -5.9845 });
    expect(service.precise()).toBeTrue();
    expect(service.approxCity()).toBeNull();
  });

  it('si /api/geo no existe (ng serve devuelve el index.html), sigue sin ubicación', async () => {
    state = 'prompt';
    (window.fetch as jasmine.Spy).and.callFake(() =>
      Promise.resolve(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })));
    const service = await started();
    expect(service.coords()).toBeNull();
  });
});

describe('ubicación', () => {
  const now = Date.UTC(2026, 10, 7, 12, 0, 0);
  const day = 24 * 60 * 60 * 1000;

  describe('parseStoredFix', () => {
    it('lee una posición guardada hace poco, marcada como no precisa', () => {
      const raw = JSON.stringify({ lat: 37.39, lng: -5.98, at: now - day });
      expect(parseStoredFix(raw, now)).toEqual({ lat: 37.39, lng: -5.98, precise: false });
    });

    it('descarta una de hace más de una semana: puede ser de otra ciudad', () => {
      const raw = JSON.stringify({ lat: 37.39, lng: -5.98, at: now - 8 * day });
      expect(parseStoredFix(raw, now)).toBeNull();
    });

    it('descarta lo vacío, lo roto y lo que no son coordenadas', () => {
      expect(parseStoredFix(null, now)).toBeNull();
      expect(parseStoredFix('no es json', now)).toBeNull();
      expect(parseStoredFix(JSON.stringify({ lat: '37', lng: -5.98, at: now }), now)).toBeNull();
      expect(parseStoredFix(JSON.stringify({ lat: 120, lng: -5.98, at: now }), now)).toBeNull();
      expect(parseStoredFix(JSON.stringify({ lat: 37.39, lng: -5.98 }), now)).toBeNull();
    });

    it('descarta una fechada en el futuro (reloj cambiado)', () => {
      const raw = JSON.stringify({ lat: 37.39, lng: -5.98, at: now + day });
      expect(parseStoredFix(raw, now)).toBeNull();
    });
  });

  describe('distanceKm', () => {
    it('es cero en el mismo punto', () => {
      expect(distanceKm({ lat: 37.39, lng: -5.98 }, { lat: 37.39, lng: -5.98 })).toBe(0);
    });

    it('Sevilla–Madrid sale por los 390 km en línea recta', () => {
      const km = distanceKm({ lat: 37.3891, lng: -5.9845 }, { lat: 40.4168, lng: -3.7038 });
      expect(km).toBeGreaterThan(380);
      expect(km).toBeLessThan(400);
    });
  });

  describe('deniedHelp', () => {
    it('en el iPhone manda a los ajustes del sistema y del sitio', () => {
      const text = deniedHelp('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1');
      expect(text).toContain('Privacidad y seguridad');
    });

    it('en Firefox habla de su icono de permisos', () => {
      expect(deniedHelp('Mozilla/5.0 (Windows NT 10.0; rv:130.0) Gecko/20100101 Firefox/130.0'))
        .toContain('Acceder a tu ubicación');
    });

    it('en Chrome o Edge, el icono junto a la dirección', () => {
      const text = deniedHelp('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0');
      expect(text).toContain('Permisos del sitio');
    });

    it('siempre dice que hay que recargar: el navegador no vuelve a preguntar', () => {
      expect(deniedHelp('')).toContain('recarga');
    });
  });
});
