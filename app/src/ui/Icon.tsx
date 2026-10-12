// Small inline line icons (24px grid, 1.8 stroke). Decorative unless given a label.
const paths: Record<string, string> = {
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 6l6 6-6 6',
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  list: 'M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01',
  meals: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2.5 5-2 8h3V3zM18 11v10',
  family: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.8.8 3 2.7 3 5.5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  more: 'M5 11.5v1M12 11.5v1M19 11.5v1',
  check: 'M5 12l5 5 9-10',
  store: 'M4 9l1.5-5h13L20 9M4 9h16v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-4 2.8M5 13v7h14v-7',
  calendar: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M8 2v4M16 2v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6.2M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01',
  share: 'M12 4v11M7 9l5-5 5 5M5 14v5h14v-5',
  bell: 'M6 16.5h12l-1.6-2.2V10a4.4 4.4 0 0 0-8.8 0v4.3zM10 19.5a2 2 0 0 0 4 0',
  todos: 'M8 6h11v15H8zM5 4v14M11 11l1.5 1.5L15.5 9M11 17h5',
};

export function Icon({ name, label, className }: { name: keyof typeof paths | string; label?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={paths[name] ?? ''} />
    </svg>
  );
}
