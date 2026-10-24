import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OnboardingComponent } from './components/onboarding/onboarding';

@Component({
  selector: 'app-onboarding-page',
  imports: [OnboardingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding-page.html',
})
export class OnboardingPage {}
