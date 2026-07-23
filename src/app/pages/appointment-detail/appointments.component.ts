import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BipsyService } from '../../services/bipsy.service';
import { Appointment } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.css'
})
export class AppointmentsComponent implements OnInit {
  activeTab: 'upcoming' | 'completed' = 'upcoming';
  allAppointments: Appointment[] = [];
  filteredAppointments: Appointment[] = [];
  isLoading: boolean = true;

  constructor(private bipsyService: BipsyService) {}

  ngOnInit(): void {
    // Fetch real bookings from backend; falls back to empty list
    this.bipsyService.getBookings().subscribe(data => {
      this.allAppointments = data;
      this.filterAppointments();
      this.isLoading = false;
    });

    // Also subscribe to live updates (e.g. after creating a new booking)
    this.bipsyService.appointments$.subscribe(data => {
      this.allAppointments = data;
      this.filterAppointments();
    });
  }

  setTab(tab: 'upcoming' | 'completed'): void {
    this.activeTab = tab;
    this.filterAppointments();
  }

  filterAppointments(): void {
    if (this.activeTab === 'upcoming') {
      this.filteredAppointments = this.allAppointments.filter(a => a.status === 'upcoming');
    } else {
      this.filteredAppointments = this.allAppointments.filter(a => a.status === 'completed' || a.status === 'cancelled');
    }
  }
}
