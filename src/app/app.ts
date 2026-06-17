import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavigation } from "./shared/components/navigation/navigation.component";
import { LogOverlayComponent } from "./shared/components/log-overlay/log-overlay.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNavigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
