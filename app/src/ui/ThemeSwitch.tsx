import { useState } from 'react';
import { readTheme, saveTheme, type ThemeChoice } from '../lib/theme';

const options: { value: ThemeChoice; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Automatic / Light / Dark for this device. */
export function ThemeSwitch() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);
  return (
    <div className="field">
      <span id="theme-label">Appearance</span>
      <div className="segmented" role="group" aria-labelledby="theme-label">
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={choice === o.value}
            onClick={() => { setChoice(o.value); saveTheme(o.value); }}>{o.label}</button>
        ))}
      </div>
      <span className="hint">Automatic follows your phone’s setting. Saved on this device only.</span>
    </div>
  );
}
