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
export type MealType = Tables<'meal_types'>;
export type Dish = Tables<'dishes'>;
export type DishMealType = Tables<'dish_meal_types'>;
export type DishIngredient = Tables<'dish_ingredients'>;
export type PrepStep = Tables<'dish_prep_steps'>;
export type PlannedMeal = Tables<'planned_meals'>;
export type Task = Tables<'tasks'>;
export type ListEntry = Tables<'list_entries'>;
export type ListReason = Tables<'list_entry_reasons'>;

// School timetables (kept apart from the family calendar)
export type Kid = Tables<'kids'>;
export type SchoolTerm = Tables<'school_terms'>;
export type SchoolClass = Tables<'school_classes'>;
export type SchoolException = Tables<'school_exceptions'>;
