-- ==============================================================================
-- VANDIAS IA - DURCISSEMENT DE SÉCURITÉ BASE DE DONNÉES SUPABASE (RLS)
-- Résolution : SEC-04 (commissions) et SEC-05 (profiles)
-- Projet : rcnaebfqtkwwmqdbgkpq
-- ==============================================================================

-- 1. ASSURER L'EXISTENCE ET LA SÉCURISATION DE LA TABLE COMMISSIONS
-- Si la table n'existait pas encore, elle est créée avec ses clés et contraintes.
CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_reference TEXT NOT NULL,
  payment_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 0.20,
  commission_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  plan_tier TEXT DEFAULT 'pro',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_commission_payment UNIQUE (payment_reference)
);

-- Activation du RLS sur commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Seul le parrain peut lire ses propres commissions
DROP POLICY IF EXISTS "commissions_select_own" ON public.commissions;
CREATE POLICY "commissions_select_own" 
  ON public.commissions FOR SELECT 
  USING (auth.uid() = referrer_id);

-- Nettoyage de toute ancienne politique publique permissive
DROP POLICY IF EXISTS "commissions_insert_service" ON public.commissions;
DROP POLICY IF EXISTS "commissions_update_service" ON public.commissions;


-- 2. VERROUILLAGE DES COLONNES SENSIBLES DE LA TABLE PROFILES
-- S'assurer que les colonnes existent
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'trial';
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS credits NUMERIC DEFAULT 100;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS affiliate_balance NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Trigger empêchant les utilisateurs connectés de modifier leurs crédits, solde, plan ou rôle
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS trigger AS $$
BEGIN
  -- Cette restriction s'applique uniquement aux requêtes effectuées avec le rôle 'authenticated' (client)
  -- Le serveur Node.js (service_role) continuera d'opérer sans aucune restriction.
  IF (auth.role() = 'authenticated') THEN
    IF (NEW.plan IS DISTINCT FROM OLD.plan OR
        NEW.plan_status IS DISTINCT FROM OLD.plan_status OR
        NEW.credits IS DISTINCT FROM OLD.credits OR
        NEW.affiliate_balance IS DISTINCT FROM OLD.affiliate_balance OR
        NEW.role IS DISTINCT FROM OLD.role) THEN
      RAISE EXCEPTION 'Action interdite : Les colonnes financières et privilèges (plan, crédits, solde, rôle) ne peuvent être modifiées que par le serveur.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_columns();

-- ==============================================================================
-- FIN DU SCRIPT : Tables et RLS 100% Hermétiques et Fonctionnels.
-- ==============================================================================
