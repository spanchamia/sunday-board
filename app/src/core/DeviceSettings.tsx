import { useState } from 'react';
import { readHidePrivate, readStartScreen, saveHidePrivate, saveStartScreen, type StartScreen } from '../lib/device';

/** Per-device choices: what the app opens on (a kitchen tablet can open on the calendar). */
export function DeviceSettings() {
  const [start, setStart] = useState<StartScreen>(readStartScreen);
  const [hide, setHide] = useState(readHidePrivate);
  return (
    <>
      <div className="field">
        <span id="start-label">Opens on</span>
        <div className="segmented" role="group" aria-labelledby="start-label">
          {([['start', 'Home'], ['calendar', 'Calendar']] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={start === v} onClick={() => { setStart(v); saveStartScreen(v); }}>{label}</button>
          ))}
        </div>
        <span className="hint">Choose Calendar on the kitchen tablet. Saved on this device only.</span>
      </div>
      <label className="check-row" style={{ padding: 0 }}>
        <input type="checkbox" checked={hide} onChange={(e) => { setHide(e.target.checked); saveHidePrivate(e.target.checked); }} />
        <span className="grow">Hide my “Just me” to-dos on this device
          <span className="meta" style={{ display: 'block' }}>For a shared screen everyone can see.</span></span>
      </label>
    </>
  );
}
