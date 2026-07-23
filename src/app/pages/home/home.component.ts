import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BipsyService } from '../../services/bipsy.service';
import { BusinessResponse, CategoryResponse } from '../../models/bipsy.models';
import { BusinessCardComponent } from '../../components/business-card/business-card.component';
import { ButtonComponent } from '../../components/button/button.component';
import { ChipComponent } from '../../components/chip/chip.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, BusinessCardComponent, ButtonComponent, ChipComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  selectedCategoryCode: string = 'ALL';
  selectedCategoryId?: number;
  searchQuery: string = '';

  categories: CategoryResponse[] = [];
  businesses: BusinessResponse[] = [];
  featuredBusinesses: BusinessResponse[] = [];
  isLoading: boolean = true;

  @ViewChild('featuredScroll') featuredScrollRef?: ElementRef;
  
  // Chips drag state
  private isDragging = false;
  private startX = 0;
  private startScrollLeft = 0;

  // Carousel continuous animation frame ID
  private animationFrameId?: number;

  constructor(
    private bipsyService: BipsyService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.stopContinuousScroll();
  }

  loadData(): void {
    this.isLoading = true;

    this.bipsyService.getCategories().subscribe(cats => {
      this.categories = [{ id: 0, code: 'ALL', name: 'Todo', active: true }, ...cats];
    });

    this.bipsyService.getFeaturedBusinesses(12).subscribe(data => {
      this.featuredBusinesses = data.slice(0, 6);
      this.businesses = data;
      this.isLoading = false;
      this.startContinuousScroll();
    });
  }

  selectCategory(cat: CategoryResponse): void {
    this.selectedCategoryCode = cat.code;
    this.selectedCategoryId = cat.id === 0 ? undefined : cat.id;
    this.stopContinuousScroll();

    if (cat.id === 0) {
      this.loadData();
    } else {
      this.isLoading = true;
      this.bipsyService.searchBusinesses(undefined, undefined, cat.id).subscribe(res => {
        this.businesses = res;
        this.featuredBusinesses = res.slice(0, 6);
        this.isLoading = false;
      });
    }
  }

  executeSearch(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    }
  }

  getSelectedCategoryName(): string {
    const cat = this.categories.find(c => c.code === this.selectedCategoryCode);
    return cat?.name || 'Resultados';
  }

  /** Icon Material Symbol name for each category code */
  getCategoryIcon(code: string): string {
    const icons: Record<string, string> = {
      'ALL': 'grid_view',
      'BARBER': 'content_cut',
      'BARBERSHOP': 'content_cut',
      'HAIRDRESSER': 'face',
      'ESTHETIC': 'spa',
      'NAILS': 'brush',
      'MASSAGE': 'self_improvement',
      'TATTOO': 'draw',
      'MAKEUP': 'brush',
      'EYEBROWS': 'visibility',
      'PHYSIO': 'healing',
      'PERSONAL_TRAINER': 'fitness_center',
      'LASER': 'bolt',
      'NUTRITION': 'restaurant',
    };
    return icons[code] || 'spa';
  }

  scroll(element: HTMLElement, amount: number): void {
    element.scrollBy({ left: amount, behavior: 'smooth' });
  }

  // Tags Drag & Drop scroll logic
  onDragStart(e: MouseEvent, el: HTMLElement): void {
    this.isDragging = true;
    el.classList.add('grabbing');
    this.startX = e.pageX - el.offsetLeft;
    this.startScrollLeft = el.scrollLeft;
  }

  onDragEnd(el: HTMLElement): void {
    this.isDragging = false;
    el.classList.remove('grabbing');
  }

  onDragMove(e: MouseEvent, el: HTMLElement): void {
    if (!this.isDragging) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - this.startX) * 1.5; // scroll-speed multiplier
    el.scrollLeft = this.startScrollLeft - walk;
  }

  // Buttery-smooth requestAnimationFrame continuous horizontal auto-scroll
  private pollInterval: any;

  startContinuousScroll(): void {
    this.stopContinuousScroll();
    
    let attempts = 0;
    this.pollInterval = setInterval(() => {
      const el = document.querySelector('.featured-scroll') as HTMLElement;
      attempts++;
      
      if (el) {
        clearInterval(this.pollInterval);
        this.pollInterval = undefined;

        let currentScroll = el.scrollLeft;

        const step = () => {
          const maxScroll = el.scrollWidth - el.clientWidth;
          if (maxScroll <= 0) {
            this.animationFrameId = requestAnimationFrame(step);
            return;
          }

          currentScroll += 0.55; // Accumulate float value
          el.scrollLeft = currentScroll; // Assign to browser scrollLeft

          const halfWidth = el.scrollWidth / 2;
          if (el.scrollLeft >= halfWidth) {
            currentScroll = el.scrollLeft - halfWidth;
            el.scrollLeft = currentScroll;
          }

          this.animationFrameId = requestAnimationFrame(step);
        };

        this.animationFrameId = requestAnimationFrame(step);
      } else if (attempts > 30) {
        clearInterval(this.pollInterval);
        this.pollInterval = undefined;
      }
    }, 100);
  }

  stopContinuousScroll(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }

  clientEmail: string = '';

  onDownloadClick(): void {
    if (this.clientEmail.trim()) {
      alert(`¡Enlace de descarga enviado a ${this.clientEmail.trim()}! Redirigiendo a la descarga...`);
      window.open('https://www.youtube.com', '_blank');
    } else {
      alert('Por favor, introduce tu correo electrónico.');
    }
  }
}
