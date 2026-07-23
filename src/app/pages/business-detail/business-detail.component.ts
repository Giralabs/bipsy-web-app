import { Component, OnInit } from '@angular/core';
import { CommonModule, Location, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BipsyService } from '../../services/bipsy.service';
import { BusinessResponse, ServiceResponse, ReviewResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { ChipComponent } from '../../components/chip/chip.component';

@Component({
  selector: 'app-business-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DecimalPipe, ButtonComponent, ChipComponent],
  templateUrl: './business-detail.component.html',
  styleUrl: './business-detail.component.css'
})
export class BusinessDetailComponent implements OnInit {
  business?: BusinessResponse;
  services: ServiceResponse[] = [];
  reviews: ReviewResponse[] = [];
  isLoading: boolean = true;
  isFavorite: boolean = false;

  // Booking Modal State
  selectedServiceForBooking?: ServiceResponse;
  selectedDate: string = 'Mañana, 22 de Julio';
  selectedTime: string = '11:30';
  bookingSuccess: boolean = false;

  timeSlots = ['10:00', '10:30', '11:00', '11:30', '12:00', '16:30', '17:00', '18:00'];
  availableDates = ['Hoy, 21 de Julio', 'Mañana, 22 de Julio', 'Jueves, 23 de Julio'];

  constructor(
    private route: ActivatedRoute,
    private bipsyService: BipsyService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '1';
      this.loadBusinessDetails(id);
    });
  }

  loadBusinessDetails(id: string): void {
    this.isLoading = true;
    
    // 1. Fetch Business
    this.bipsyService.getBusinessById(id).subscribe(b => {
      this.business = b;
      this.isLoading = false;
    });

    // 2. Fetch Services
    this.bipsyService.getBusinessServices(id).subscribe(s => {
      this.services = s;
    });

    // 3. Fetch Reviews
    this.bipsyService.getReviewsByBusiness(id).subscribe(r => {
      this.reviews = r;
    });
  }

  goBack(): void {
    this.location.back();
  }

  toggleFavorite(): void {
    this.isFavorite = !this.isFavorite;
  }

  openBookingModal(service: ServiceResponse): void {
    this.selectedServiceForBooking = service;
    this.bookingSuccess = false;
  }

  closeBookingModal(): void {
    this.selectedServiceForBooking = undefined;
    this.bookingSuccess = false;
  }

  confirmBooking(): void {
    if (this.business && this.selectedServiceForBooking) {
      const payload = {
        businessId: this.business.id,
        serviceId: this.selectedServiceForBooking.id,
        date: this.selectedDate,
        time: this.selectedTime
      };

      this.bipsyService.createBooking(payload).subscribe(() => {
        this.bookingSuccess = true;
      });
    }
  }

  getBusinessCoverUrl(): string {
    if (!this.business) return '';
    const rawUrl = this.business.coverImageUrl || this.business.profileImageUrl;
    if (rawUrl && rawUrl.trim().length > 0) {
      if (rawUrl.startsWith('http')) {
        return rawUrl;
      }
      if (rawUrl.startsWith('/')) {
        return `http://localhost:8080${rawUrl}`;
      }
      return `http://localhost:8080/${rawUrl}`;
    }

    const name = (this.business.name ?? '').toLowerCase();
    let cat = 'salon';
    if (name.includes('barber') || name.includes('maestro')) {
      cat = 'barber';
    } else if (name.includes('pelu') || name.includes('style') || name.includes('hair')) {
      cat = 'hairdresser';
    } else if (name.includes('nail') || name.includes('unas') || name.includes('manicura')) {
      cat = 'nails';
    } else if (name.includes('spa') || name.includes('bienestar') || name.includes('masaje')) {
      cat = 'massage';
    } else if (name.includes('estet') || name.includes('clinica') || name.includes('belleza') || name.includes('andaluz')) {
      cat = 'esthetic';
    }

    const seed = this.business.id ?? 1;
    return `https://picsum.photos/seed/gipsi-${cat}-${seed}/800/500`;
  }
}
