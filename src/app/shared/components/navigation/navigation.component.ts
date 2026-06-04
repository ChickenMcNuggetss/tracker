import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly exact: boolean;
}

@Component({
  selector: 'app-navigation',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss',
})
export class AppNavigation {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/home', exact: true },
    { label: 'Calendar', path: '/calendar', exact: true },
    { label: 'Logs', path: '/logs', exact: true },
    { label: 'Profile', path: '/profile', exact: true },
  ];
}
