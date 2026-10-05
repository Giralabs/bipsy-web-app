import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { ChatRepository } from '../../repositories/chat.repository';
import { ConversationResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { fixImageUrl } from '../../shared/image-url';
import { parseLocal, relativeDate, time } from '../../shared/dates';

/** Bandeja de mensajes. Port de `ChatInboxScreen`. */
@Component({
  selector: 'app-chat-inbox',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.css',
})
export class ChatInboxComponent implements OnInit {
  private readonly chat = inject(ChatRepository);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  conversations: ConversationResponse[] = [];
  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;

  ngOnInit(): void {
    this.session.status$.subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      if (this.isAuthenticated) {
        void this.load();
      } else {
        this.isLoading = false;
      }
    });
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      this.conversations = await this.chat.inbox();
    } catch (raw) {
      this.loadError = ApiError.from(raw);
    } finally {
      this.isLoading = false;
    }
  }

  avatar(conversation: ConversationResponse): string | null {
    return fixImageUrl(conversation.otherPartyImageUrl);
  }

  /** Hoy la hora; antes, el día. Es lo que hace cualquier bandeja. */
  when(conversation: ConversationResponse): string {
    if (!conversation.lastMessageAt) {
      return '';
    }
    const at = parseLocal(conversation.lastMessageAt);
    const isToday = new Date().toDateString() === at.toDateString();
    return isToday ? time(at) : relativeDate(at);
  }

  open(conversation: ConversationResponse): void {
    this.router.navigate(['/mensajes', conversation.id]);
  }

  goToLogin(): void {
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/mensajes' } });
  }

  goExplore(): void {
    this.router.navigate(['/']);
  }
}
