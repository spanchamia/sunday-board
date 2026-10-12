// Larger line drawings for the launcher tiles (64px grid). Decorative: the tile's
// label names it. Drawn for this app; simple strokes so they suit light and dark.
const drawings: Record<string, string[]> = {
  kitchen: [
    'M8 30h48v24H8z', 'M32 30v24',                       // counter, split
    'M12 38h16v12H12z', 'M15 34h.01M20 34h.01M25 34h.01', // oven, knobs
    'M36 38h16M36 46h16M42 34h4M42 42h4M42 50h4',         // drawers + handles
    'M10 20h20l-3-6H13z', 'M20 14v-4',                    // hood
    'M36 10h16v14H36z', 'M44 10v14M41 16v2M47 16v2',      // wall cabinet
  ],
  dishes: [
    'M32 50a18 18 0 1 0 0-36 18 18 0 0 0 0 36z',          // plate
    'M32 43a11 11 0 1 0 0-22 11 11 0 0 0 0 22z',
    'M8 14v9a3.5 3.5 0 0 0 7 0v-9M11.5 14v7M11.5 26.5V50', // fork
    'M53 14c-2.2 0-3.5 2.8-3.5 6.2s1.5 5.8 3.5 5.8 3.5-2.5 3.5-5.8S55.2 14 53 14zM53 26v24', // spoon
  ],
  plan: [
    'M10 14h44v40H10z', 'M10 24h44', 'M20 9v9M44 9v9',
    'M32 49a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19z', 'M32 34v5.5l4 2.5',
  ],
  calendar: [
    'M8 12h48v44H8z', 'M8 22h48', 'M18 7v9M46 7v9',
    'M16 30h6v5h-6zM29 30h6v5h-6zM42 30h6v5h-6z',
    'M16 42h6v5h-6zM42 42h6v5h-6z', 'M29 42h6v5h-6z',
    'M30 44l2 2 3.5-3.5',
  ],
  list: [
    'M14 9h30v46H14z', 'M23 9v-2h12v2',
    'M19 18h6v6h-6zM20.5 21l1.5 1.5 3-3.5', 'M30 21h9',
    'M19 30h6v6h-6zM30 33h9', 'M19 42h6v6h-6zM30 45h9',
    'M50 12v34l-2.5 6-2.5-6V12zM45 18h5',
  ],
  stores: [
    'M12 10h40l4 12H8z', 'M8 22a6 6 0 0 0 12 0 6 6 0 0 0 12 0 6 6 0 0 0 12 0 6 6 0 0 0 12 0',
    'M12 28v26h40V28', 'M18 54V38h10v16', 'M34 38h13v9H34z', 'M6 54h52',
  ],
  home: [
    'M8 31L32 11l24 20', 'M15 26v28h34V26', 'M27 54V40h10v14',
    'M41 35h6v6h-6z', 'M42 18v-7h5v11', 'M6 54h52',
  ],
  todos: [
    'M20 12V8h28v40h-6', 'M12 14h30v44H12z',
    'M17 25l2.5 2.5 4.5-5M28 25h9', 'M17 36l2.5 2.5 4.5-5M28 36h9', 'M17 47h4M28 47h9',
    'M54 20l4 4-14 14-5.5 1.5L40 34z',
  ],
};

export function TileIcon({ name }: { name: keyof typeof drawings | string }) {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {(drawings[name] ?? drawings.home!).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
