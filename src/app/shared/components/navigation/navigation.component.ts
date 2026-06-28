import { BreakpointObserver, LayoutModule } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly path: string;
  readonly exact: boolean;
}

@Component({
  selector: 'app-navigation',
  imports: [RouterLink, RouterLinkActive, LayoutModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss',
})
export class AppNavigation {
  breakpointObserver = inject(BreakpointObserver);

  readonly navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      path: '/home',
      exact: true,
    },
    {
      label: 'Calendar',
      icon: 'calendar_today',
      path: '/calendar',
      exact: true,
    },
    {
      label: 'Profile',
      icon: 'person',
      path: '/profile',
      exact: true,
    },
  ];

  protected isMobile = signal(false);
  protected isMenuOpen = signal(false);

  constructor() {
    this.breakpointObserver.observe('(max-width: 740px)').subscribe((result) => {
      this.isMobile.set(result.matches);
    });
  }
}
