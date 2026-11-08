import { DestroyRef } from '@angular/core';
import { onRevisit } from './revisit';

/** Un DestroyRef de mentira que se puede disparar a mano. */
function fakeDestroyRef(): { ref: DestroyRef; destroy: () => void } {
  const callbacks: (() => void)[] = [];
  const ref = { onDestroy: (cb: () => void) => { callbacks.push(cb); return () => undefined; } } as DestroyRef;
  return { ref, destroy: () => callbacks.forEach(cb => cb()) };
}

describe('onRevisit', () => {
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    spyOn(Date, 'now').and.callFake(() => now);
  });

  it('no pide nada nada más cargar: los datos son de ahora', () => {
    const { ref, destroy } = fakeDestroyRef();
    const run = jasmine.createSpy('run');
    onRevisit(ref, run, 10_000);
    window.dispatchEvent(new Event('focus'));
    expect(run).not.toHaveBeenCalled();
    destroy();
  });

  it('vuelve a pedir al recuperar el foco pasado el margen, y solo una vez', () => {
    const { ref, destroy } = fakeDestroyRef();
    const run = jasmine.createSpy('run');
    onRevisit(ref, run, 10_000);
    now += 15_000;
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(run).toHaveBeenCalledTimes(1);
    destroy();
  });

  it('al volver con «atrás» desde la caché del navegador pide siempre', () => {
    const { ref, destroy } = fakeDestroyRef();
    const run = jasmine.createSpy('run');
    onRevisit(ref, run, 10_000);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(run).toHaveBeenCalledTimes(1);
    destroy();
  });

  it('deja de escuchar al destruirse la página', () => {
    const { ref, destroy } = fakeDestroyRef();
    const run = jasmine.createSpy('run');
    onRevisit(ref, run, 10_000);
    destroy();
    now += 60_000;
    window.dispatchEvent(new Event('focus'));
    expect(run).not.toHaveBeenCalled();
  });
});
