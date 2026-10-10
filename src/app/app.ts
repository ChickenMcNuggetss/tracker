import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavigation } from './shared/components/navigation/navigation.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNavigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly document = inject(DOCUMENT);

  constructor() {
    if (!this.document.body.dataset['theme']) {
      this.document.body.dataset['theme'] = 'dark';
      this.document.body.classList.add('theme-dark');
    }
  }
}
