import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { OnboardingComponent } from "./components/onboarding/onboarding";


@Component({
  selector: 'app-onboarding-page',
  imports: [ReactiveFormsModule, OnboardingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding-page.html',
})
export class OnboardingPage {
}
