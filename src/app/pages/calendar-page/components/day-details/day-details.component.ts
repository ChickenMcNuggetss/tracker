import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CycleLogRecord, FlowIntensity, MoodKey, SymptomKey } from '../../../../core/db/tracker-db';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { fromDateKey } from '../../../../shared/utils/fromDateKey';

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
  calm: { label: 'CalmFocused', icon: '◔' },
  sensitive: { label: 'Sensitive', icon: '◕' },
  low: { label: 'LowEnergy', icon: '☹' },
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
  imports: [TranslatePipe],
  templateUrl: './day-details.component.html',
  styleUrl: './day-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayDetailsComponent {
  private readonly translate = inject(TranslateService);
  private readonly currentLanguage = toSignal(
    this.translate.onLangChange.pipe(map(({ lang }) => lang)),
    {
      initialValue: this.translate.currentLang() ?? 'en',
    },
  );

  // accept a date key and compute a localized label here
  readonly dateKey = input<string>('');
  readonly dateLabel = computed(() => {
    const key = this.dateKey();
    if (!key) return '';
    const date = fromDateKey(key);
    const locale = this.translate.currentLang() || 'en-US';
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(date);
  });
  readonly entry = input<CycleLogRecord | null>(null);
  readonly isPeriod = input<boolean>(false);
  readonly isOvulation = input<boolean>(false);
  readonly editRequested = output<void>();

  readonly flowLabel = computed(() => {
    this.currentLanguage();
    const entry = this.entry();

    if (!entry) {
      return this.translate.instant('NoFlowLogged');
    }

    return this.translate.instant(FLOW_LABELS[entry.flowIntensity]);
  });

  readonly mood = computed(() => {
    this.currentLanguage();
    const entry = this.entry();

    if (!entry) {
      return null;
    }

    const detail = MOOD_LABELS[entry.mood];

    return detail ? { ...detail, label: this.translate.instant(detail.label) } : null;
  });

  readonly symptoms = computed(() => {
    this.currentLanguage();
    const entry = this.entry();

    if (!entry) {
      return [];
    }

    return entry.symptoms.map((symptom) => this.translate.instant(SYMPTOM_LABELS[symptom]));
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
