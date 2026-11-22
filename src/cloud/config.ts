/**
 * Projet Supabase pour les comptes. La clé « anon » est faite pour être publique :
 * ce sont les règles d'accès (docs/supabase.sql) qui protègent les données.
 * Ne jamais mettre ici la clé « service_role ».
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const cloudEnabled = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
