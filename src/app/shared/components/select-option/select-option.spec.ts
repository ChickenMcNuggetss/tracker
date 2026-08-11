import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectOption } from './select-option';

describe('SelectOption', () => {
  let component: SelectOption;
  let fixture: ComponentFixture<SelectOption>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectOption]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectOption);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
