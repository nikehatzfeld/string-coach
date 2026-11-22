/**
 * Projet Supabase pour les comptes. La clé « anon » est faite pour être publique :
 * ce sont les règles d'accès (docs/supabase.sql) qui protègent les données.
 * Ne jamais mettre ici la clé « service_role ».
 */
export const SUPABASE_URL = 'https://vjxnftnvpbcgtgecqtze.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_dDJdUB6pIrBwcsyHu79Qnw_S4dEaqW5';

export const cloudEnabled = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
