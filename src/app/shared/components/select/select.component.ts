import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  contentChildren,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { SelectOption } from '../select-option/select-option';

@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectComponent {
  label = input<string>('');
  name = input<string>('');
  value = input<string>('');
  disabled = input<boolean>(false);
  control = input<FormControl<string | null> | null>(null);

  valueChange = output<string>();

  options = contentChildren(SelectOption);

  isOpen = signal(false);

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  get selectedOption(): SelectOption | undefined {
    return this.options().find((option) => option.value() === this.value());
  }

  toggle(): void {
    if (this.disabled()) {
      return;
    }

    this.isOpen.update((open) => !open);
  }

  selectOption(option: SelectOption): void {
    if (this.disabled()) {
      return;
    }

    const value = option.value();

    this.control()?.setValue(value);
    this.valueChange.emit(value);

    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;

    if (!this.elementRef.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.isOpen.set(false);
  }
}
