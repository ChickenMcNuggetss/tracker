import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Button } from './button.component';

describe('Button', () => {
  let component: Button;
  let fixture: ComponentFixture<Button>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Button],
    }).compileComponents();

    fixture = TestBed.createComponent(Button);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render with default primary variant', () => {
    const button = fixture.nativeElement.querySelector('button');
    expect(button.classList.contains('btn')).toBe(true);
    expect(button.classList.contains('btn--primary')).toBe(true);
  });

  it('should apply secondary variant class', () => {
    fixture.componentRef.setInput('variant', 'secondary');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.classList.contains('btn--secondary')).toBe(true);
    expect(button.classList.contains('btn--primary')).toBe(false);
  });

  it('should disable the button when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
  });

  it('should be enabled by default', () => {
    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(false);
  });
});
