import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConversationResponse } from '../../models/bipsy.models';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { conversationPreview, inboxWhen } from './chat-format';

/**
 * Las filas de la bandeja. Port de `GipsiChatConversationTile` y del
 * esqueleto de `ChatInboxScreen`.
 *
 * Es un componente aparte porque lo pintan dos pantallas: la bandeja, y en
 * escritorio la columna izquierda del hilo, que es la misma lista. Tenerla dos
 * veces era garantizar que acabaran diciendo cosas distintas.
 *
 * Cada fila es un enlace y no un botón: abre una página, se puede abrir en
 * otra pestaña y el lector de pantalla la anuncia como lo que es.
 */
@Component({
  selector: 'app-chat-conversation-list',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
  templateUrl: './conversation-list.component.html',
  styleUrl: './conversation-list.component.css',
})
export class ChatConversationListComponent {
  @Input() conversations: ConversationResponse[] = [];

  /** Pinta el esqueleto en vez de las filas. */
  @Input() loading = false;

  /** La conversación abierta al lado, en escritorio. */
  @Input() activeId: number | null = null;

  /** Filas del esqueleto: seis, como la app. */
  readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  readonly when = inboxWhen;
  readonly preview = conversationPreview;

  /**
   * La cara de quien atiende si es un trabajador —la misma que enseña el
   * hilo—; si no, la del negocio.
   */
  avatarName(c: ConversationResponse): string {
    return c.handlerName || c.otherPartyName;
  }

  avatarUrl(c: ConversationResponse): string | undefined {
    return c.handlerName ? c.handlerImageUrl : c.otherPartyImageUrl;
  }

  /** Lo que lee el lector de pantalla: la fila entera en una frase. */
  label(c: ConversationResponse): string {
    const unread = c.unread > 0
      ? `, ${c.unread} ${c.unread === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}`
      : '';
    const when = this.when(c.lastMessageAt);
    return `${c.otherPartyName}${unread}. ${this.preview(c)}${when ? `. ${when}` : ''}`;
  }
}
