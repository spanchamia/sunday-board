import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** A panel that slides up from the bottom (centred on wide screens). Escape or ✕ closes it. */
export function Sheet({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);
  return (
    <dialog ref={ref} className="sheet" onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="sheet-title">
      <div className="sheet-head">
        <h2 id="sheet-title" className="grow">{title}</h2>
        {actions}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}
