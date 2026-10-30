import { ChatMessageResponse, ConversationResponse } from '../../models/bipsy.models';
import { parseLocal } from '../../shared/dates';

/**
 * Textos y formatos del chat. Port de los `static` de `GipsiChatDaySeparator`,
 * `GipsiChatConversationTile` y `GipsiChatAttachment`.
 *
 * Viven aparte y no en `shared/dates` porque no son formatos generales: la
 * bandeja escribe «Mié» y el hilo «21 de agosto», y en el resto de la web una
 * fecha se dice de otra manera («Mar 28 abr»). Mezclarlos acabaría con un
 * `relativeDate` que dice una cosa en citas y otra en mensajes.
 */

/** Estado de entrega de un mensaje propio. Port de `GipsiChatDelivery`. */
export type ChatDelivery = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

const MONTH_DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Días naturales entre hoy y `when`: 0 hoy, 1 ayer. */
function daysAgo(when: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  return Math.round((today.getTime() - day.getTime()) / 86_400_000);
}

/** "21:40". Con ceros: es lo que pinta la app (`padLeft(2, '0')`). */
export function hhmm(when: Date): string {
  return `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
}

/**
 * La píldora del separador: "Hoy", "Ayer", "21 de agosto", o con año si es de
 * otro. El año solo cuando hace falta: ponerlo siempre alarga la píldora en el
 * 99 % de los casos en que sobra.
 */
export function dayLabel(when: Date): string {
  const diff = daysAgo(when);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return when.getFullYear() === new Date().getFullYear()
    ? MONTH_DAY.format(when)
    : MONTH_DAY_YEAR.format(when);
}

/** Si dos mensajes caen en días distintos. */
export function differentDay(a: Date, b: Date): boolean {
  return a.toDateString() !== b.toDateString();
}

/**
 * La hora de una fila de la bandeja: la hora si es de hoy, «Ayer», el día de
 * la semana si es de esta semana y la fecha corta si es más viejo. Es lo que
 * espera cualquiera que use una app de mensajería.
 */
export function inboxWhen(value?: string): string {
  if (!value) return '';
  const when = parseLocal(value);
  const diff = daysAgo(when);
  if (diff <= 0) return hhmm(when);
  if (diff === 1) return 'Ayer';
  if (diff < 7) return WEEKDAYS[when.getDay()];
  return `${when.getDate()}/${when.getMonth() + 1}`;
}

/**
 * El extracto con «Tú:» delante si el último lo escribió uno mismo: es lo que
 * evita confundir un hilo ya contestado con uno pendiente.
 */
export function conversationPreview(conversation: ConversationResponse): string {
  const text = conversation.lastMessagePreview;
  if (!text) return 'Sin mensajes todavía';
  return conversation.lastMessageSide === 'CUSTOMER' ? `Tú: ${text}` : text;
}

/** «Te atiende Marta»: solo el nombre de pila, como la app. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Tamaño legible. Los adjuntos topan en 10 MB, así que no hacen falta más unidades. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Foto si lo dice el tipo del mensaje o, en su defecto, el del archivo. */
export function isImageMessage(message: ChatMessageResponse): boolean {
  if (message.kind === 'IMAGE') return true;
  if (message.kind === 'FILE') return false;
  return (message.attachment?.contentType ?? '').startsWith('image/');
}

/** Icono del documento. Port de `GipsiChatAttachment._iconFor`. */
export function documentIcon(message: ChatMessageResponse): string {
  const type = message.attachment?.contentType ?? '';
  const name = (message.attachment?.filename ?? '').toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'picture_as_pdf';
  if (type.includes('word') || type.includes('document') || /\.(docx?|odt|rtf)$/.test(name)) return 'description';
  if (type.startsWith('text/') || /\.(txt|csv)$/.test(name)) return 'article';
  return 'draft';
}

export function isPdf(message: ChatMessageResponse): boolean {
  const type = message.attachment?.contentType ?? '';
  return type === 'application/pdf' || (message.attachment?.filename ?? '').toLowerCase().endsWith('.pdf');
}

/**
 * Identificador de un envío. Identifica la burbuja provisional para cambiarla
 * por la real y, sobre todo, hace que un reintento no duplique el mensaje si
 * el primero sí llegó. El backend lo topa en 64 caracteres.
 */
export function newClientMessageId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `web-${Date.now()}-${random}`.slice(0, 64);
}
