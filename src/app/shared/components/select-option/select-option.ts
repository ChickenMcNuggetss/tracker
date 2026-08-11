import { Component, input } from '@angular/core';

@Component({
  selector: 'app-select-option',
  template: `
    <span class="select-option__label">
      {{ label() }}
    </span>
  `,
})
export class SelectOption {
  value = input.required<string>();
  label = input.required<string>();
}
