import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavigation } from './shared/components/navigation/navigation.component';
import { TranslatePipe } from '@ngx-translate/core';
import { AppUpdateService } from './core/services/app-update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNavigation, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly appUpdate = inject(AppUpdateService);
  readonly updateAvailable = this.appUpdate.updateAvailable;

  constructor() {
    if (!this.document.body.dataset['theme']) {
      this.document.body.dataset['theme'] = 'dark';
      this.document.body.classList.add('theme-dark');
    }
  }

  reloadToUpdate(): void {
    void this.appUpdate.reloadToUpdate();
  }
}
