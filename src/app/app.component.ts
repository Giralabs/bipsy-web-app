import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { PromoBarComponent } from './components/promo-bar/promo-bar.component';
import { SearchHeaderComponent } from './components/search-header/search-header.component';
import { AppBannerComponent } from './components/app-banner/app-banner.component';
import { TabBarComponent } from './components/tab-bar/tab-bar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AppBannerComponent,
    TabBarComponent,
    PromoBarComponent,
    NavbarComponent,
    SearchHeaderComponent,
    FooterComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Bipsy';
}
