import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CycleLogRecord, FlowIntensity, MoodKey, SymptomKey } from '../../../../core/db/tracker-db';

interface DetailOption {
  readonly label: string;
  readonly icon: string;
}

const FLOW_LABELS: Record<FlowIntensity, string> = {
  none: 'None',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
};

const MOOD_LABELS: Record<MoodKey, DetailOption> = {
  happy: { label: 'Happy', icon: '☺' },
  calm: { label: 'Calm & focused', icon: '◔' },
  sensitive: { label: 'Sensitive', icon: '◕' },
  low: { label: 'Low energy', icon: '☹' },
  irritated: { label: 'Irritated', icon: '!' },
};

const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  cramps: 'Cramps',
  headache: 'Headache',
  bloating: 'Bloating',
  acne: 'Acne',
  tender: 'Tender',
  fatigue: 'Fatigue',
};

@Component({
  selector: 'app-day-details',
  templateUrl: './day-details.component.html',
  styleUrl: './day-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayDetailsComponent {
  readonly dateLabel = input<string>('');
  readonly entry = input<CycleLogRecord | null>(null);
  readonly isPeriod = input<boolean>(false);
  readonly isOvulation = input<boolean>(false);
  readonly editRequested = output<void>();

  readonly flowLabel = computed(() => {
    const entry = this.entry();
    return entry ? FLOW_LABELS[entry.flowIntensity] : 'No flow logged';
  });

  readonly mood = computed(() => {
    const entry = this.entry();
    return entry ? MOOD_LABELS[entry.mood] : null;
  });

  readonly symptoms = computed(() => {
    const entry = this.entry();
    return entry ? entry.symptoms.map((symptom) => SYMPTOM_LABELS[symptom]) : [];
  });

  readonly notes = computed(() => {
    const entry = this.entry();
    return entry ? entry.notes : null;
  });

  readonly moodMeterValue = computed(() => {
    const mood = this.entry()?.mood;

    switch (mood) {
      case 'happy':
        return 88;
      case 'calm':
        return 74;
      case 'sensitive':
        return 56;
      case 'low':
        return 36;
      case 'irritated':
        return 28;
      default:
        return 0;
    }
  });

  openEditor(): void {
    this.editRequested.emit();
  }
}
