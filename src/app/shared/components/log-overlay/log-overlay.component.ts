import { DOCUMENT, JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  computed,
  effect,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormControl } from '@angular/forms';
import { FlowIntensity, MoodKey, SymptomKey } from '../../../core/db/tracker-db';
import { LogEntriesService } from '../../../core/services/log-entries.service';

interface FlowOption {
  value: FlowIntensity;
  label: string;
}

interface MoodOption {
  value: MoodKey;
  label: string;
  icon: string;
}

interface SymptomOption {
  value: SymptomKey;
  label: string;
}

interface OverlayForm {
  flowIntensity: FormControl<FlowIntensity>;
  symptoms: FormControl<SymptomKey[]>;
  mood: FormControl<MoodKey>;
  sexualActivity: FormControl<boolean>;
  vaginalDischarge: FormControl<boolean>;
  notes: FormControl<string>;
}

const FLOW_OPTIONS: FlowOption[] = [
  { value: 'none', label: 'None' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];

const MOOD_OPTIONS: MoodOption[] = [
  { value: 'happy', label: 'Happy', icon: '☺' },
  { value: 'calm', label: 'Calm', icon: '◔' },
  { value: 'sensitive', label: 'Sensitive', icon: '◕' },
  { value: 'low', label: 'Low', icon: '☹' },
  { value: 'irritated', label: 'Irritated', icon: '!' },
];

const SYMPTOM_OPTIONS: SymptomOption[] = [
  { value: 'cramps', label: 'Cramps' },
  { value: 'headache', label: 'Headache' },
  { value: 'bloating', label: 'Bloating' },
  { value: 'acne', label: 'Acne' },
  { value: 'tender', label: 'Tender' },
  { value: 'fatigue', label: 'Fatigue' },
];

@Component({
  selector: 'app-log-overlay',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './log-overlay.component.html',
  styleUrl: './log-overlay.component.scss',
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class LogOverlayComponent {
  private readonly logEntriesService = inject(LogEntriesService);
  private readonly fb = inject(FormBuilder);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly flowOptions = FLOW_OPTIONS;
  readonly moodOptions = MOOD_OPTIONS;
  readonly symptomOptions = SYMPTOM_OPTIONS;

  readonly overlayState = this.logEntriesService.overlayState;

  readonly title = computed(() =>
    this.overlayState()?.mode === 'edit' ? 'Edit Logs' : 'Quick Log',
  );

  readonly subtitle = computed(() => {
    const state = this.overlayState();

    if (!state) {
      return '';
    }

    return state.mode === 'edit'
      ? 'Update the log for this day.'
      : 'Capture how today feels at a glance.';
  });

  readonly dateLabel = computed(() => {
    const state = this.overlayState();

    if (!state) {
      return '';
    }

    return this.formatDate(state.dateKey);
  });

  readonly entryLog = computed(() => {
    const state = this.overlayState();

    if (!state) {
      return null;
    }

    return this.logEntriesService.entryForDate(state.dateKey);
  });

  readonly form = this.fb.group<OverlayForm>({
    flowIntensity: this.fb.nonNullable.control<FlowIntensity>('none', {
      validators: [Validators.required],
    }),
    symptoms: this.fb.nonNullable.control<SymptomKey[]>([]),
    mood: this.fb.nonNullable.control<MoodKey>('calm', {
      validators: [Validators.required],
    }),
    sexualActivity: this.fb.nonNullable.control(false),
    vaginalDischarge: this.fb.nonNullable.control(false),
    notes: this.fb.nonNullable.control(''),
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.document.body.style.overflow = '';
    });

    effect(() => {
      const state = this.overlayState();

      if (!state) {
        this.resetForm();
        return;
      }

      this.patchFormFromEntry(this.entryLog());
    });
  }

  close(): void {
    if (!this.overlayState()) {
      return;
    }

    this.logEntriesService.closeOverlay();
  }

  backdropClick(): void {
    this.close();
  }

  stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  setFlowIntensity(flowIntensity: FlowIntensity): void {
    this.form.controls.flowIntensity.setValue(flowIntensity);
    this.form.controls.flowIntensity.markAsDirty();
  }

  toggleSymptom(symptom: SymptomKey): void {
    const current = this.form.controls.symptoms.value;
    const next = current.includes(symptom)
      ? current.filter((value) => value !== symptom)
      : [...current, symptom];

    this.form.controls.symptoms.setValue(next);
    this.form.controls.symptoms.markAsDirty();
  }

  setMood(mood: MoodKey): void {
    this.form.controls.mood.setValue(mood);
    this.form.controls.mood.markAsDirty();
  }

  toggleSignal(controlName: 'sexualActivity' | 'vaginalDischarge'): void {
    const control = this.form.controls[controlName];
    control.setValue(!control.value);
    control.markAsDirty();
  }

  isSymptomSelected(symptom: SymptomKey): boolean {
    return this.form.controls.symptoms.value.includes(symptom);
  }

  async save(): Promise<void> {
    const state = this.overlayState();

    if (!state || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    await this.logEntriesService.saveEntry(state.dateKey, {
      flowIntensity: this.form.controls.flowIntensity.value,
      symptoms: this.form.controls.symptoms.value,
      mood: this.form.controls.mood.value,
      sexualActivity: this.form.controls.sexualActivity.value,
      vaginalDischarge: this.form.controls.vaginalDischarge.value,
      notes: this.form.controls.notes.value,
    });

    this.logEntriesService.closeOverlay();
  }

  private patchFormFromEntry(entry: ReturnType<typeof this.entryLog>): void {
    this.form.patchValue(
      {
        flowIntensity: entry?.flowIntensity ?? 'none',
        symptoms: entry?.symptoms ?? [],
        mood: entry?.mood ?? 'calm',
        sexualActivity: entry?.sexualActivity ?? false,
        vaginalDischarge: entry?.vaginalDischarge ?? false,
        notes: entry?.notes ?? '',
      },
      { emitEvent: false },
    );
  }

  private resetForm(): void {
    this.form.reset(
      {
        flowIntensity: 'none',
        symptoms: [],
        mood: 'calm',
        sexualActivity: false,
        vaginalDischarge: false,
        notes: '',
      },
      { emitEvent: false },
    );
  }

  private formatDate(dateKey: string): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }
}
