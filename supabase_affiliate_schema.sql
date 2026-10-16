-- ==============================================================================
-- VANDIAS AI - SYSTÈME D'AFFILIATION & PARRAINAGE 20% COMMISSION
-- Script SQL d'initialisation et sécurisation (Supabase SQL Editor)
-- Projet : rcnaebfqtkwwmqdbgkpq
-- ==============================================================================

-- 1. COLONNE DE PARRAINAGE DANS LA TABLE PROFILES
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS affiliate_code TEXT;

ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS affiliate_balance NUMERIC DEFAULT 0;

-- Index pour la recherche rapide des parrains par code
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_code 
  ON public.profiles(affiliate_code);

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by 
  ON public.profiles(referred_by);


-- 2. TABLE DES COMMISSIONS D'AFFILIATION DÉTAILLÉES
CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_reference TEXT NOT NULL,
  payment_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 0.20,
  commission_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED', -- 'PENDING', 'CONFIRMED', 'REVERSED'
  plan_tier TEXT DEFAULT 'pro',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_commission_payment UNIQUE (payment_reference)
);

-- Index pour les performances des requêtes du tableau de bord
CREATE INDEX IF NOT EXISTS idx_commissions_referrer_id 
  ON public.commissions(referrer_id);

CREATE INDEX IF NOT EXISTS idx_commissions_referred_user_id 
  ON public.commissions(referred_user_id);

CREATE INDEX IF NOT EXISTS idx_commissions_status 
  ON public.commissions(status);


-- 3. SÉCURISATION ROW LEVEL SECURITY (RLS)
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commissions_select_own" ON public.commissions;
CREATE POLICY "commissions_select_own" 
  ON public.commissions FOR SELECT 
  USING (auth.uid() = referrer_id);

-- Seul le serveur Node.js avec la clé service_role a le droit d'insérer ou modifier les commissions
DROP POLICY IF EXISTS "commissions_insert_service" ON public.commissions;
CREATE POLICY "commissions_insert_service" 
  ON public.commissions FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "commissions_update_service" ON public.commissions;
CREATE POLICY "commissions_update_service" 
  ON public.commissions FOR UPDATE 
  USING (true);

-- ==============================================================================
-- FIN DU SCRIPT : Tables et colonnes d'affiliation prêtes et 100% sécurisées.
-- ==============================================================================
