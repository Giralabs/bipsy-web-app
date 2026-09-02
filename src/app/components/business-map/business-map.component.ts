import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BusinessResponse, businessLocationDisplay } from '../../models/bipsy.models';
import { businessPath } from '../../shared/slug';
import { loadGoogleMaps, googleMapsAuthFailed } from '../../core/google-maps-loader';
import {
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  googleMapsApiKey,
  isGoogleMapsConfigured,
} from '../../../environments/maps.config';

/** La zona elegida en el mapa: un punto y cuánto se abarca alrededor. */
export interface SearchArea {
  lat: number;
  lng: number;
  radiusKm: number;
}

/**
 * Mapa de resultados y selector de zona. Port de `BusinessMapView` +
 * `zone_picker_sheet` de la app.
 *
 * **El mismo mapa que en el móvil**: Google Maps con el estilo de
 * `GipsiMapStyle`, que cambia solo entre claro y oscuro — Google Maps no sigue
 * el tema, y sin eso en modo oscuro entra un mapa blanco a pantalla completa.
 *
 * **La zona se elige tocando el mapa**, igual que en el móvil.
 *
 * ⚠️ Necesita una clave **propia de la web** (ver `maps.config.ts`): la de las
 * apps está atada al paquete y al SHA-1 y la del backend no puede salir de
 * ahí. Sin clave, Buscar esconde el botón del mapa.
 */
@Component({
  selector: 'app-business-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './business-map.component.html',
  styleUrl: './business-map.component.css',
})
export class BusinessMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly router = inject(Router);

  @ViewChild('canvas') canvas?: ElementRef<HTMLElement>;

  @Input() businesses: BusinessResponse[] = [];
  @Input() area: SearchArea | null = null;

  @Output() areaChange = new EventEmitter<SearchArea | null>();

  /** El negocio de la tarjeta flotante, si hay alguno tocado. */
  selected: BusinessResponse | null = null;
  ready = false;
  loadFailed = false;

  private map?: google.maps.Map;
  private markers: google.maps.Marker[] = [];
  private circle?: google.maps.Circle;
  private center?: google.maps.Marker;
  private darkQuery?: MediaQueryList;
  private readonly onSchemeChange = () => this.applyStyle();

  /** Sevilla. Solo se usa si no hay ni zona ni negocios que encuadrar. */
  private static readonly FALLBACK = { lat: 37.3891, lng: -5.9845 };

  async ngAfterViewInit(): Promise<void> {
    if (!this.canvas || !isGoogleMapsConfigured()) {
      this.loadFailed = !isGoogleMapsConfigured();
      return;
    }

    try {
      await loadGoogleMaps();
    } catch {
      this.loadFailed = true;
      return;
    }

    const start = this.area ?? this.firstBusinessPoint() ?? BusinessMapComponent.FALLBACK;

    try {
      this.buildMap(start);
    } catch {
      this.loadFailed = true;
      return;
    }

    this.ready = true;
    this.redraw();
    this.fitToBusinesses();
  }

  /** Si Google rechazó la clave, el aviso lo dice en vez de girar sin fin. */
  get authRejected(): boolean {
    return googleMapsAuthFailed();
  }

  private buildMap(start: { lat: number; lng: number }): void {
    this.map = new google.maps.Map(this.canvas!.nativeElement, {
      center: { lat: start.lat, lng: start.lng },
      zoom: this.area ? 12 : 11,
      disableDefaultUI: true,
      zoomControl: true,
      // El mapa es para elegir, no para pasear: sin satélite ni Street View,
      // que aquí no aportan y sí distraen.
      clickableIcons: false,
      styles: this.currentStyle(),
    });

    // La zona se marca tocando el mapa. Tocar fuera de un negocio también
    // cierra la tarjeta flotante: si no, se quedaba abierta tapando el mapa.
    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) {
        return;
      }
      this.selected = null;
      this.emitArea({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
        radiusKm: this.area?.radiusKm ?? 5,
      });
    });

    // El tema se puede cambiar con el mapa abierto.
    this.darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.darkQuery.addEventListener('change', this.onSchemeChange);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ready) {
      return;
    }
    this.redraw();
    if (changes['businesses'] && !this.area) {
      this.fitToBusinesses();
    }
  }

  ngOnDestroy(): void {
    this.darkQuery?.removeEventListener('change', this.onSchemeChange);
    this.clearOverlays();
  }

  // ----- ZONA --------------------

  get radiusKm(): number {
    return this.area?.radiusKm ?? 5;
  }

  onRadiusChange(value: string): void {
    if (this.area) {
      this.emitArea({ ...this.area, radiusKm: Number(value) });
    }
  }

  clearArea(): void {
    this.selected = null;
    this.emitArea(null);
  }

  openBusiness(business: BusinessResponse): void {
    this.router.navigate(businessPath(business));
  }

  locationOf(business: BusinessResponse): string {
    return businessLocationDisplay(business);
  }

  private emitArea(area: SearchArea | null): void {
    this.area = area;
    this.areaChange.emit(area);
    this.redraw();
  }

  // ----- PINTADO --------------------

  private currentStyle(): google.maps.MapTypeStyle[] {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? MAP_STYLE_DARK
      : MAP_STYLE_LIGHT;
  }

  private applyStyle(): void {
    this.map?.setOptions({ styles: this.currentStyle() });
    this.redraw();
  }

  private redraw(): void {
    const map = this.map;
    if (!map) {
      return;
    }

    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];

    for (const business of this.businesses) {
      if (business.latitude == null || business.longitude == null) {
        continue;
      }
      const marker = new google.maps.Marker({
        map,
        position: { lat: business.latitude, lng: business.longitude },
        title: business.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#C0EED3',
          fillOpacity: 1,
          strokeColor: '#23282E',
          strokeWeight: 3,
        },
      });
      // Tocar un negocio no marca zona: son dos cosas distintas sobre el mismo
      // lienzo.
      marker.addListener('click', () => (this.selected = business));
      this.markers.push(marker);
    }

    this.circle?.setMap(null);
    this.center?.setMap(null);
    this.circle = undefined;
    this.center = undefined;

    if (this.area) {
      const position = { lat: this.area.lat, lng: this.area.lng };
      this.circle = new google.maps.Circle({
        map,
        center: position,
        radius: this.area.radiusKm * 1000,
        strokeColor: '#C0EED3',
        strokeWeight: 2,
        fillColor: '#C0EED3',
        fillOpacity: 0.12,
        clickable: false,
      });
      this.center = new google.maps.Marker({
        map,
        position,
        clickable: false,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: '#C0EED3',
          fillOpacity: 1,
          strokeColor: '#23282E',
          strokeWeight: 2,
        },
      });
    }
  }

  /** Encuadra los resultados. Solo sin zona marcada: con ella manda la zona. */
  private fitToBusinesses(): void {
    const points = this.businesses.filter(b => b.latitude != null && b.longitude != null);
    if (!this.map || points.length === 0) {
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach(b => bounds.extend({ lat: b.latitude!, lng: b.longitude! }));
    this.map.fitBounds(bounds, 48);

    // Con un solo punto, el encuadre se mete al máximo zoom y el mapa queda en
    // una manzana sin nada alrededor: no se entiende dónde está.
    google.maps.event.addListenerOnce(this.map, 'idle', () => {
      const zoom = this.map?.getZoom() ?? 0;
      if (zoom > 15) {
        this.map?.setZoom(14);
      }
    });
  }

  private firstBusinessPoint(): { lat: number; lng: number } | null {
    const found = this.businesses.find(b => b.latitude != null && b.longitude != null);
    return found ? { lat: found.latitude!, lng: found.longitude! } : null;
  }

  private clearOverlays(): void {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
    this.circle?.setMap(null);
    this.center?.setMap(null);
  }
}
