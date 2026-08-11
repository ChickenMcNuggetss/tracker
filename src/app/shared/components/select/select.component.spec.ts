import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent } from './select.component';

@Component({
  standalone: true,
  template: `
    <app-select label="Category" [disabled]="disabled()" [control]="control()" (valueChange)="onValueChange($event)">
      <option value="alpha">Alpha</option>
      <option value="beta">Beta</option>
    </app-select>
  `,
  imports: [SelectComponent, ReactiveFormsModule],
})
class SelectHostComponent {
  disabled = input<boolean>(false);
  control = input<FormControl<string | null> | null>(null);
  lastValue: string | null = null;

  onValueChange(value: string): void {
    this.lastValue = value;
  }
}

describe('SelectComponent', () => {
  let fixture: ComponentFixture<SelectHostComponent>;
  let host: SelectHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the label and projected options', () => {
    const label = fixture.nativeElement.querySelector('.select__label');
    const options = fixture.nativeElement.querySelectorAll('option');

    expect(label?.textContent).toContain('Category');
    expect(options.length).toBe(2);
    expect(options[0].textContent).toContain('Alpha');
  });

  it('should emit the selected value when the user changes the selection', () => {
    const select = fixture.nativeElement.querySelector('select');
    select.value = 'beta';
    select.dispatchEvent(new Event('change'));

    expect(host.lastValue).toBe('beta');
  });

  it('should write the selected value into a passed form control', () => {
    const control = new FormControl('alpha');
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select');
    select.value = 'beta';
    select.dispatchEvent(new Event('change'));

    expect(control.value).toBe('beta');
  });

  it('should disable the control when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select');
    expect(select.disabled).toBe(true);
  });
});
