import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProfileComponent } from "./components/profile/profile";
import { SyncPanelComponent } from '../../shared/components/sync-panel/sync-panel.component';

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, ProfileComponent, SyncPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-page.html',
})
export class ProfilePage {
}
