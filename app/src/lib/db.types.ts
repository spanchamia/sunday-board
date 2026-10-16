// Generated from the Supabase schema (equivalent to `supabase gen types typescript`).
// Regenerate after every migration. Do not edit by hand.
/* eslint-disable */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' }
  public: {
    Tables: {
      catalog_items: {
        Row: { aliases: string[]; category_path: string[]; id: string; name: string; restock_mode: string; search_text: string; sizes: string[]; tags: string[] }
        Insert: { aliases?: string[]; category_path?: string[]; id?: string; name: string; restock_mode?: string; search_text?: string; sizes?: string[]; tags?: string[] }
        Update: { aliases?: string[]; category_path?: string[]; id?: string; name?: string; restock_mode?: string; search_text?: string; sizes?: string[]; tags?: string[] }
        Relationships: []
      }
      categories: {
        Row: { created_at: string; default_restock_mode: string | null; family_id: string; id: string; name: string; parent_id: string | null; sort: number }
        Insert: { created_at?: string; default_restock_mode?: string | null; family_id: string; id?: string; name: string; parent_id?: string | null; sort?: number }
        Update: { created_at?: string; default_restock_mode?: string | null; family_id?: string; id?: string; name?: string; parent_id?: string | null; sort?: number }
        Relationships: []
      }
      dish_ingredients: {
        Row: { amount: string | null; dish_id: string; family_id: string; item_id: string }
        Insert: { amount?: string | null; dish_id: string; family_id: string; item_id: string }
        Update: { amount?: string | null; dish_id?: string; family_id?: string; item_id?: string }
        Relationships: []
      }
      dish_meal_types: {
        Row: { dish_id: string; family_id: string; meal_type_id: string }
        Insert: { dish_id: string; family_id: string; meal_type_id: string }
        Update: { dish_id?: string; family_id?: string; meal_type_id?: string }
        Relationships: []
      }
      dish_prep_steps: {
        Row: { dish_id: string; family_id: string; id: string; lead_minutes: number; name: string; sort: number }
        Insert: { dish_id: string; family_id: string; id?: string; lead_minutes: number; name: string; sort?: number }
        Update: { dish_id?: string; family_id?: string; id?: string; lead_minutes?: number; name?: string; sort?: number }
        Relationships: []
      }
      dishes: {
        Row: { archived_at: string | null; created_at: string; family_id: string; id: string; make_every_days: number | null; name: string; notes: string; weekdays_ok: boolean; weekends_ok: boolean }
        Insert: { archived_at?: string | null; created_at?: string; family_id: string; id?: string; make_every_days?: number | null; name: string; notes?: string; weekdays_ok?: boolean; weekends_ok?: boolean }
        Update: { archived_at?: string | null; created_at?: string; family_id?: string; id?: string; make_every_days?: number | null; name?: string; notes?: string; weekdays_ok?: boolean; weekends_ok?: boolean }
        Relationships: []
      }
      families: {
        Row: { created_at: string; id: string; invite_code: string; name: string; timezone: string }
        Insert: { created_at?: string; id?: string; invite_code?: string; name: string; timezone?: string }
        Update: { created_at?: string; id?: string; invite_code?: string; name?: string; timezone?: string }
        Relationships: []
      }
      family_members: {
        Row: { display_name: string; family_id: string; joined_at: string; role: string; user_id: string }
        Insert: { display_name?: string; family_id: string; joined_at?: string; role?: string; user_id: string }
        Update: { display_name?: string; family_id?: string; joined_at?: string; role?: string; user_id?: string }
        Relationships: []
      }
      item_events: {
        Row: { created_at: string; family_id: string; happened_on: string; id: string; item_id: string; kind: string; store_id: string | null; user_id: string | null }
        Insert: { created_at?: string; family_id: string; happened_on?: string; id?: string; item_id: string; kind: string; store_id?: string | null; user_id?: string | null }
        Update: { created_at?: string; family_id?: string; happened_on?: string; id?: string; item_id?: string; kind?: string; store_id?: string | null; user_id?: string | null }
        Relationships: []
      }
      item_stores: {
        Row: { family_id: string; item_id: string; preferred: boolean; store_id: string }
        Insert: { family_id: string; item_id: string; preferred?: boolean; store_id: string }
        Update: { family_id?: string; item_id?: string; preferred?: boolean; store_id?: string }
        Relationships: []
      }
      push_subscriptions: {
        Row: { auth: string; created_at: string; endpoint: string; family_id: string; gone_at: string | null; p256dh: string; summary_sent_on: string | null; summary_time: string | null; user_id: string }
        Insert: { auth: string; created_at?: string; endpoint: string; family_id: string; p256dh: string; summary_sent_on?: string | null; summary_time?: string | null; user_id?: string }
        Update: { auth?: string; created_at?: string; endpoint?: string; family_id?: string; p256dh?: string; summary_sent_on?: string | null; summary_time?: string | null; user_id?: string }
        Relationships: []
      }
      items: {
        Row: { archived_at: string | null; catalog_item_id: string | null; category_id: string | null; created_at: string; family_id: string; id: string; learned_every_days: number | null; name: string; notes: string; restock_every_days: number | null; restock_mode: string | null; updated_at: string; usual_amount: string | null }
        Insert: { archived_at?: string | null; catalog_item_id?: string | null; category_id?: string | null; created_at?: string; family_id: string; id?: string; learned_every_days?: number | null; name: string; notes?: string; restock_every_days?: number | null; restock_mode?: string | null; updated_at?: string; usual_amount?: string | null }
        Update: { archived_at?: string | null; catalog_item_id?: string | null; category_id?: string | null; created_at?: string; family_id?: string; id?: string; learned_every_days?: number | null; name?: string; notes?: string; restock_every_days?: number | null; restock_mode?: string | null; updated_at?: string; usual_amount?: string | null }
        Relationships: []
      }
      list_entries: {
        Row: { added_at: string; added_by: string | null; amount: string | null; amount_hint: string; closed_at: string | null; family_id: string; id: string; item_id: string; status: string; store_id: string | null }
        Insert: { added_at?: string; added_by?: string | null; amount?: string | null; amount_hint?: string; closed_at?: string | null; family_id: string; id?: string; item_id: string; status?: string; store_id?: string | null }
        Update: { added_at?: string; added_by?: string | null; amount?: string | null; amount_hint?: string; closed_at?: string | null; family_id?: string; id?: string; item_id?: string; status?: string; store_id?: string | null }
        Relationships: []
      }
      list_entry_reasons: {
        Row: { created_at: string; dish_id: string | null; entry_id: string; family_id: string; id: string; planned_meal_id: string | null; reason: string }
        Insert: { created_at?: string; dish_id?: string | null; entry_id: string; family_id: string; id?: string; planned_meal_id?: string | null; reason: string }
        Update: { created_at?: string; dish_id?: string | null; entry_id?: string; family_id?: string; id?: string; planned_meal_id?: string | null; reason?: string }
        Relationships: []
      }
      meal_type_items: {
        Row: { family_id: string; item_id: string; meal_type_id: string }
        Insert: { family_id: string; item_id: string; meal_type_id: string }
        Update: { family_id?: string; item_id?: string; meal_type_id?: string }
        Relationships: []
      }
      meal_types: {
        Row: { family_id: string; id: string; name: string; sort: number; usual_time: string | null }
        Insert: { family_id: string; id?: string; name: string; sort?: number; usual_time?: string | null }
        Update: { family_id?: string; id?: string; name?: string; sort?: number; usual_time?: string | null }
        Relationships: []
      }
      planned_meals: {
        Row: { created_at: string; created_by: string | null; date: string; dish_id: string | null; family_id: string; id: string; item_id: string | null; meal_type_id: string }
        Insert: { created_at?: string; created_by?: string | null; date: string; dish_id?: string | null; family_id: string; id?: string; item_id?: string | null; meal_type_id: string }
        Update: { created_at?: string; created_by?: string | null; date?: string; dish_id?: string | null; family_id?: string; id?: string; item_id?: string | null; meal_type_id?: string }
        Relationships: []
      }
      starter_pack_items: {
        Row: { catalog_item_id: string; pack_id: string }
        Insert: { catalog_item_id: string; pack_id: string }
        Update: { catalog_item_id?: string; pack_id?: string }
        Relationships: []
      }
      starter_packs: {
        Row: { description: string; id: string; name: string; sort: number }
        Insert: { description?: string; id: string; name: string; sort?: number }
        Update: { description?: string; id?: string; name?: string; sort?: number }
        Relationships: []
      }
      stores: {
        Row: { created_at: string; family_id: string; id: string; name: string; sort: number }
        Insert: { created_at?: string; family_id: string; id?: string; name: string; sort?: number }
        Update: { created_at?: string; family_id?: string; id?: string; name?: string; sort?: number }
        Relationships: []
      }
      tasks: {
        Row: { created_at: string; done_at: string | null; due_on: string | null; due_time: string | null; family_id: string; id: string; owner_id: string; planned_meal_id: string | null; prep_step_id: string | null; remind_before: number[]; repeat_every: number | null; repeat_unit: string | null; series_id: string | null; title: string; visibility: string }
        Insert: { created_at?: string; done_at?: string | null; due_on?: string | null; due_time?: string | null; family_id: string; id?: string; owner_id?: string; planned_meal_id?: string | null; prep_step_id?: string | null; remind_before?: number[]; repeat_every?: number | null; repeat_unit?: string | null; series_id?: string | null; title: string; visibility?: string }
        Update: { created_at?: string; done_at?: string | null; due_on?: string | null; due_time?: string | null; family_id?: string; id?: string; owner_id?: string; planned_meal_id?: string | null; prep_step_id?: string | null; remind_before?: number[]; repeat_every?: number | null; repeat_unit?: string | null; series_id?: string | null; title?: string; visibility?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_family: { Args: { family_name: string; my_name: string }; Returns: string }
      join_family: { Args: { code: string; my_name: string }; Returns: string }
      new_invite_code: { Args: never; Returns: string }
      remove_push_subscription: { Args: { p_endpoint: string }; Returns: undefined }
      set_push_summary: { Args: { p_endpoint: string; p_time: string | null }; Returns: undefined }
      save_push_device: { Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_tz?: string; p_replaces?: string }; Returns: undefined }
      save_push_subscription: { Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_tz?: string }; Returns: undefined }
      search_catalog: { Args: { max_results?: number; q: string }; Returns: { aliases: string[]; category_path: string[]; id: string; name: string; restock_mode: string; search_text: string; sizes: string[]; tags: string[] }[]; SetofOptions: { from: '*'; to: 'catalog_items'; isOneToOne: false; isSetofReturn: true } }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicTables = Database['public']['Tables']
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']
