import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProfileComponent } from "./components/profile/profile";

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, ProfileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-page.html',
})
export class ProfilePage {
}
