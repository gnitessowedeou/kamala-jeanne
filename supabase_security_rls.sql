-- ==============================================================================
-- VANDIA AI - SÉCURISATION SUPABASE ROW LEVEL SECURITY (RLS)
-- Résolution de l'alerte critique : "Table publicly accessible (rls_disabled_in_public)"
-- Projet : rcnaebfqtkwwmqdbgkpq
-- ==============================================================================

-- 1. ACTIVATION DE ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES PUBLIQUES
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payouts ENABLE ROW LEVEL SECURITY;

-- 2. POLITIQUES DE SÉCURITÉ POUR LA TABLE 'PROFILES'
-- Note : Le backend Node.js (server.js) utilise la clé de service (service_role), 
-- qui contourne automatiquement le RLS en toute sécurité.

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- 3. POLITIQUES DE SÉCURITÉ POUR LA TABLE 'CONTACTS'
DROP POLICY IF EXISTS "contacts_all_own" ON public.contacts;
CREATE POLICY "contacts_all_own" 
  ON public.contacts FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 4. POLITIQUES DE SÉCURITÉ POUR LA TABLE 'PAYOUTS'
DROP POLICY IF EXISTS "payouts_select_own" ON public.payouts;
CREATE POLICY "payouts_select_own" 
  ON public.payouts FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "payouts_insert_own" ON public.payouts;
CREATE POLICY "payouts_insert_own" 
  ON public.payouts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- FIN DU SCRIPT : Vos tables sont désormais 100% sécurisées contre tout accès public.
-- ==============================================================================
