import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/**
 * A panel that slides up from the bottom (centred on wide screens). Escape or ✕ closes it.
 * Always placed at the top level of the page (a portal), wherever it's opened from: older
 * Safari draws dialogs badly when they sit inside a rounded, clipped box such as a list row.
 */
export function Sheet({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);
  return createPortal(
    <dialog ref={ref} className="sheet" onCancel={(e) => { e.preventDefault(); onClose(); }}
      // Taps inside the sheet stay inside it (they'd otherwise reach the row that opened it).
      onClick={(e) => { e.stopPropagation(); if (e.target === ref.current) onClose(); }} aria-labelledby="sheet-title">
      <div className="sheet-head">
        <h2 id="sheet-title" className="grow">{title}</h2>
        {actions}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className="sheet-body">{children}</div>
    </dialog>,
    document.body,
  );
}
