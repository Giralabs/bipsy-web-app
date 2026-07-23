import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BusinessResponse } from '../../models/bipsy.models';

@Component({
  selector: 'app-business-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './business-card.component.html',
  styleUrl: './business-card.component.css'
})
export class BusinessCardComponent {
  @Input() business!: BusinessResponse;
  @Input() compact: boolean = false;

  get imageUrl(): string {
    const rawUrl = this.business?.coverImageUrl || this.business?.profileImageUrl;
    if (rawUrl && rawUrl.trim().length > 0) {
      if (rawUrl.startsWith('http')) {
        return rawUrl;
      }
      if (rawUrl.startsWith('/')) {
        return `http://localhost:8080${rawUrl}`;
      }
      return `http://localhost:8080/${rawUrl}`;
    }

    const name = (this.business?.name ?? '').toLowerCase();
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

    const seed = this.business?.id ?? 1;
    return `https://picsum.photos/seed/gipsi-${cat}-${seed}/800/500`;
  }

  get hasRating(): boolean {
    return typeof this.business?.averageRating === 'number' &&
           this.business.averageRating > 0 &&
           typeof this.business.reviewCount === 'number' &&
           this.business.reviewCount > 0;
  }

  get ratingDisplay(): string {
    return (this.business?.averageRating ?? 0).toFixed(1).replace('.', ',');
  }

  get reviewCount(): number {
    return this.business?.reviewCount ?? 0;
  }
}
