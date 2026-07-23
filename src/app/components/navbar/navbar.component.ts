import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BipsyService } from '../../services/bipsy.service';
import { UserProfileDto } from '../../models/bipsy.models';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule, ButtonComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  currentUser: UserProfileDto | null = null;
  isAuthModalOpen: boolean = false;
  isLoginMode: boolean = true;

  emailInput: string = '';
  passwordInput: string = '';
  nameInput: string = '';
  authError: string = '';

  constructor(
    public bipsyService: BipsyService,
    private router: Router
  ) {}

  onBizPromoClick(): void {
    this.router.navigate(['/home']).then(() => {
      setTimeout(() => {
        const el = document.querySelector('.business-promo');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    });
  }

  ngOnInit(): void {
    this.bipsyService.currentUser$.subscribe(u => {
      this.currentUser = u;
    });

    this.bipsyService.isAuthModalOpen$.subscribe(open => {
      this.isAuthModalOpen = open;
    });
  }

  openAuth(isLogin: boolean = true): void {
    this.isLoginMode = isLogin;
    this.authError = '';
    this.bipsyService.openAuthModal();
  }

  closeAuth(): void {
    this.bipsyService.closeAuthModal();
  }

  submitAuth(): void {
    this.authError = '';
    if (!this.emailInput || !this.passwordInput) {
      this.authError = 'Por favor completa todos los campos';
      return;
    }

    if (this.isLoginMode) {
      this.bipsyService.login(this.emailInput, this.passwordInput).subscribe({
        next: () => {
          this.closeAuth();
        },
        error: () => {
          // Demo fallback login if backend server auth fails
          this.bipsyService.fetchMe().subscribe();
          this.closeAuth();
        }
      });
    } else {
      this.bipsyService.register(this.emailInput, this.passwordInput, this.nameInput || 'Usuario Bipsy').subscribe({
        next: () => {
          this.closeAuth();
        },
        error: () => {
          this.bipsyService.fetchMe().subscribe();
          this.closeAuth();
        }
      });
    }
  }

  logout(): void {
    this.bipsyService.logout();
  }
}
