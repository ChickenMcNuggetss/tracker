import { TestBed } from '@angular/core/testing';

import { CyclePrediction } from './cycle-prediction';

describe('CyclePrediction', () => {
  let service: CyclePrediction;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CyclePrediction);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
