import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chip.component.html',
  styleUrl: './chip.component.css'
})
export class ChipComponent {
  @Input() label: string = '';
  @Input() selected: boolean = false;
  @Input() icon?: string;

  @Output() onClick = new EventEmitter<MouseEvent>();

  onChipClick(event: MouseEvent): void {
    this.onClick.emit(event);
  }
}
