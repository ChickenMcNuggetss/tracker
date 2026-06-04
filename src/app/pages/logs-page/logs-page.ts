import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-logs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logs-page.html',
  styleUrl: './logs-page.scss',
})
export class LogsPage {}
