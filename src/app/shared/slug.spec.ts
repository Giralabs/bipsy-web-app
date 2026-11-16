import { businessShareUrl } from './slug';

describe('enlace para compartir un negocio', () => {
  it('es su subdominio cuando lo tiene', () => {
    expect(businessShareUrl({ id: 19, name: 'Ismaelillo Barber', subdomain: 'ismaelillobarber' }, 'https://bipsy.es'))
      .toBe('https://ismaelillobarber.bipsy.es');
  });

  it('sin subdominio, la ficha de siempre', () => {
    expect(businessShareUrl({ id: 19, name: 'Ismaelillo Barber', subdomain: null }, 'https://bipsy.es'))
      .toBe('https://bipsy.es/negocio/ismaelillo-barber-19');
  });
});
