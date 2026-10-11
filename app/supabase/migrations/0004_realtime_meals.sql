-- Live sync for the meal tables, so a dish or meal type edited on one phone
-- shows up on the other family member's phone straight away.
alter publication supabase_realtime add table
  public.meal_types, public.dishes, public.dish_meal_types,
  public.dish_ingredients, public.dish_prep_steps;
