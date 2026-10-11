import type { Category } from '../../lib/types';
import { childrenOf, rootOf } from '../../logic/tree';

/** Every category as an indented list, top to bottom. */
export function flattenTree(categories: readonly Category[]): { c: Category; depth: number }[] {
  const out: { c: Category; depth: number }[] = [];
  const walk = (parentId: string, depth: number) => {
    for (const c of childrenOf(categories, parentId)) { out.push({ c, depth }); walk(c.id, depth + 1); }
  };
  const root = rootOf(categories);
  if (root) { out.push({ c: root, depth: 0 }); walk(root.id, 1); }
  return out;
}

export function CategorySelect({ categories, value, onChange, label = 'Category', exclude }: {
  categories: readonly Category[];
  value: string | null;
  onChange: (id: string) => void;
  label?: string;
  exclude?: ReadonlySet<string>;
}) {
  const rows = flattenTree(categories).filter((r) => !exclude?.has(r.c.id));
  return (
    <label className="field"><span>{label}</span>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {value === null && <option value="" disabled>Choose a category</option>}
        {rows.map(({ c, depth }) => (
          <option key={c.id} value={c.id}>{'   '.repeat(depth)}{c.name}</option>
        ))}
      </select>
    </label>
  );
}
