import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { SearchComponent } from './pages/search/search.component';
import { BusinessDetailComponent } from './pages/business-detail/business-detail.component';
import { AppointmentsComponent } from './pages/appointment-detail/appointments.component';
import { ProfileComponent } from './pages/profile/profile.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'search', component: SearchComponent },
  { path: 'business/:id', component: BusinessDetailComponent },
  { path: 'appointments', component: AppointmentsComponent },
  { path: 'profile', component: ProfileComponent },
  { path: '**', redirectTo: 'home' }
];
