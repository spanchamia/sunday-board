-- An item's staple / as-needed setting can now be left blank, meaning "same as its
-- category" (the nearest category up the tree that sets default_restock_mode; if none,
-- as needed). A value on the item is an exception that wins over the category.
alter table public.items alter column restock_mode drop not null;
alter table public.items alter column restock_mode drop default;
