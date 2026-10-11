import type { Tables } from './db.types';

export type Family = Tables<'families'>;
export type Member = Tables<'family_members'>;
export type Category = Tables<'categories'>;
export type Store = Tables<'stores'>;
export type Item = Tables<'items'>;
export type ItemStore = Tables<'item_stores'>;
export type CatalogItem = Tables<'catalog_items'>;
export type StarterPack = Tables<'starter_packs'>;
export type RestockMode = 'staple' | 'as_needed';
