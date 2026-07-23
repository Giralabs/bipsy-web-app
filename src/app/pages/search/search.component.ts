import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BipsyService } from '../../services/bipsy.service';
import { BusinessResponse, CategoryResponse } from '../../models/bipsy.models';
import { BusinessCardComponent } from '../../components/business-card/business-card.component';
import { ChipComponent } from '../../components/chip/chip.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BusinessCardComponent, ChipComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent implements OnInit {
  searchQuery: string = '';
  selectedCategoryId?: number;
  categories: CategoryResponse[] = [];
  businesses: BusinessResponse[] = [];
  isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private bipsyService: BipsyService
  ) {}

  ngOnInit(): void {
    this.bipsyService.getCategories().subscribe(cats => {
      this.categories = cats;
    });

    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.searchQuery = params['q'];
      }
      this.doSearch();
    });
  }

  selectCategoryFilter(catId?: number): void {
    this.selectedCategoryId = (this.selectedCategoryId === catId) ? undefined : catId;
    this.doSearch();
  }

  doSearch(): void {
    this.isLoading = true;
    this.bipsyService.searchBusinesses(this.searchQuery, undefined, this.selectedCategoryId).subscribe(results => {
      this.businesses = results;
      this.isLoading = false;
    });
  }

  getCategoryIcon(code: string): string {
    const icons: Record<string, string> = {
      'BARBER': 'content_cut',
      'BARBERSHOP': 'content_cut',
      'HAIRDRESSER': 'face',
      'ESTHETIC': 'spa',
      'NAILS': 'brush',
      'MASSAGE': 'self_improvement',
      'LASER': 'bolt',
      'NUTRITION': 'restaurant',
    };
    return icons[code] || 'spa';
  }
}
