import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { ApiError } from './api-error';
import { TokenStorageService } from './token-storage.service';

describe('ApiService — refresco de sesión', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let tokens: TokenStorageService;
  let expired: number;

  /** Deja que las promesas encadenadas lancen la siguiente petición. */
  const tick = () => new Promise(r => setTimeout(r));

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorageService);
    tokens.save({ accessToken: 'viejo', refreshToken: 'r1' });
    expired = 0;
    api.sessionExpired$.subscribe(() => expired++);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  const url = (path: string) => api.baseUrl + path;

  it('manda la cabecera de ámbito y el token', async () => {
    const p = api.get('/me');
    const req = http.expectOne(url('/me'));
    expect(req.request.headers.get('X-Bipsy-Scope')).toBe('CUSTOMER');
    expect(req.request.headers.get('Authorization')).toBe('Bearer viejo');
    req.flush({ ok: true });
    expect(await p).toEqual({ ok: true });
  });

  it('un 401 refresca, guarda el par nuevo y reintenta una vez', async () => {
    const p = api.get<{ ok: boolean }>('/me');
    http.expectOne(url('/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    const refresh = http.expectOne(url('/auth/refresh'));
    expect(refresh.request.body).toEqual({ refreshToken: 'r1' });
    expect(refresh.request.headers.has('Authorization')).toBeFalse();
    refresh.flush({ accessToken: 'nuevo', refreshToken: 'r2' });
    await tick();
    const retry = http.expectOne(url('/me'));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer nuevo');
    retry.flush({ ok: true });
    expect(await p).toEqual({ ok: true });
    expect(tokens.refreshToken).toBe('r2');
  });

  it('un 4xx del refresco borra los tokens y avisa de sesión caducada', async () => {
    const p = api.get('/me');
    http.expectOne(url('/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    http.expectOne(url('/auth/refresh')).flush(null, { status: 401, statusText: 'Unauthorized' });
    const err = await p.catch(e => e) as ApiError;
    expect(err.status).toBe(401);
    expect(tokens.accessToken).toBeNull();
    expect(tokens.refreshToken).toBeNull();
    expect(expired).toBe(1);
  });

  it('un fallo de red en el refresco NO cierra la sesión', async () => {
    const p = api.get('/me');
    http.expectOne(url('/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    http.expectOne(url('/auth/refresh')).error(new ProgressEvent('error'));
    const err = await p.catch(e => e) as ApiError;
    expect(err.networkError).toBeTrue();
    expect(err.isUnauthorized).toBeFalse();
    expect(tokens.refreshToken).toBe('r1');
    expect(expired).toBe(0);
  });

  it('un 5xx en el refresco tampoco la cierra', async () => {
    const p = api.get('/me');
    http.expectOne(url('/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    http.expectOne(url('/auth/refresh')).flush(null, { status: 503, statusText: 'Unavailable' });
    await p.catch(() => undefined);
    expect(tokens.refreshToken).toBe('r1');
    expect(expired).toBe(0);
  });

  it('dos 401 a la vez refrescan una sola vez', async () => {
    const a = api.get('/a');
    const b = api.get('/b');
    http.expectOne(url('/a')).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(url('/b')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    http.expectOne(url('/auth/refresh')).flush({ accessToken: 'nuevo', refreshToken: 'r2' });
    await tick();
    http.expectOne(url('/a')).flush(1);
    http.expectOne(url('/b')).flush(2);
    expect([await a, await b]).toEqual([1, 2]);
  });

  it('si otra pestaña ya rotó los tokens, se usa su par', async () => {
    const p = api.get('/me');
    http.expectOne(url('/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    // La otra pestaña guarda el par nuevo mientras el nuestro se rechaza.
    tokens.save({ accessToken: 'de-otra', refreshToken: 'r9' });
    http.expectOne(url('/auth/refresh')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    const retry = http.expectOne(url('/me'));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer de-otra');
    retry.flush('ok');
    expect(await p).toBe('ok');
    expect(expired).toBe(0);
  });

  it('el reintento no vuelve a refrescar (sin bucle)', async () => {
    const p = api.get('/me');
    http.expectOne(url('/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    http.expectOne(url('/auth/refresh')).flush({ accessToken: 'nuevo', refreshToken: 'r2' });
    await tick();
    http.expectOne(url('/me')).flush(null, { status: 401, statusText: 'Unauthorized' });
    const err = await p.catch(e => e) as ApiError;
    expect(err.status).toBe(401);
  });
});
