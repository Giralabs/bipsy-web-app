import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BipsyService } from '../../services/bipsy.service';
import { UserProfileDto } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  profile: UserProfileDto | null = null;
  isDarkMode: boolean = true;

  constructor(public bipsyService: BipsyService) {}

  ngOnInit(): void {
    this.bipsyService.currentUser$.subscribe(user => {
      this.profile = user || {
        name: 'Usuario Invitado',
        email: 'invitado@bipsy.com',
        phone: 'Añadir teléfono',
        role: 'Invitado',
        initials: 'UB'
      };
    });
  }

  openLogin(): void {
    this.bipsyService.openAuthModal();
  }

  logout(): void {
    this.bipsyService.logout();
  }
}
