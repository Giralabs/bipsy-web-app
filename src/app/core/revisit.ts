import { DestroyRef } from '@angular/core';

/**
 * Llama a `run` cuando quien mira vuelve a la página: a la pestaña, a la ventana
 * o desde la caché de atrás/adelante del navegador.
 *
 * La app vuelve a pedir la ficha cada vez que se abre la pantalla. La web la
 * pedía una vez y la dejaba quieta: con bipsy.es abierto en una pestaña, lo que
 * el negocio cambiaba en Bipsy Business (la portada, la foto, una foto borrada
 * de la galería) no aparecía hasta pulsar F5, y parecía que no se guardaba.
 *
 * Se escuchan tres avisos porque ninguno basta solo:
 *  - `visibilitychange`: cambiar de pestaña o minimizar.
 *  - `focus`: con dos ventanas lado a lado (el panel en una, la web en la otra)
 *    la página nunca deja de verse; solo pierde y recupera el foco.
 *  - `pageshow` con `persisted`: volver con «atrás» a una página que el
 *    navegador guardó entera no la vuelve a arrancar.
 *
 * `minGapMs` evita pedir de más: un clic en la página también devuelve el foco,
 * y entre volver a la pestaña y pulsar dentro llegan dos avisos seguidos.
 */
export function onRevisit(destroyRef: DestroyRef, run: () => void, minGapMs = 10_000): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }
  // Se cuenta desde que la página cargó: sus datos son de ese momento.
  let last = Date.now();

  const maybeRun = (force = false) => {
    if (document.visibilityState === 'hidden') {
      return;
    }
    const now = Date.now();
    if (!force && now - last < minGapMs) {
      return;
    }
    last = now;
    run();
  };

  const onVisibility = () => maybeRun();
  const onFocus = () => maybeRun();
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) maybeRun(true);
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pageshow', onPageShow);
  destroyRef.onDestroy(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pageshow', onPageShow);
  });
}
