import { TestBed } from '@angular/core/testing';

import { ProfileSettings } from './profile-settings';

describe('ProfileSettings', () => {
  let service: ProfileSettings;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProfileSettings);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
