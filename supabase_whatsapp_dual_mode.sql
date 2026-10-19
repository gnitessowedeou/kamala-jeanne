-- ==============================================================================
-- VANDIAS AI - MIGRATION DUAL MODE WHATSAPP (RAPIDE vs OFFICIEL) & SUIVI DES COÛTS
-- ==============================================================================

-- 1. Ajout des colonnes de gestion des modes sur la table profiles
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS whatsapp_mode TEXT DEFAULT 'rapide',
  ADD COLUMN IF NOT EXISTS whatsapp_risk_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_risk_accepted_ip TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_config JSONB;

-- Contrainte de validation des modes autorisés
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_whatsapp_mode_valid'
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT check_whatsapp_mode_valid 
      CHECK (whatsapp_mode IN ('rapide', 'officiel'));
  END IF;
END $$;

-- 2. Création de la table de suivi des coûts et journalisation des messages sortants
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('free_form', 'marketing', 'utility', 'service')),
  provider_mode TEXT NOT NULL CHECK (provider_mode IN ('rapide', 'officiel')),
  message_id TEXT,
  credits_deducted NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour requêtes analytiques et facturation
CREATE INDEX IF NOT EXISTS idx_wa_logs_user_created ON public.whatsapp_message_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_logs_category ON public.whatsapp_message_logs(category);
CREATE INDEX IF NOT EXISTS idx_wa_logs_mode ON public.whatsapp_message_logs(provider_mode);

-- Activation de la sécurité RLS
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- Le client peut lire uniquement ses propres logs d'envoi
DROP POLICY IF EXISTS "wa_logs_select_own" ON public.whatsapp_message_logs;
CREATE POLICY "wa_logs_select_own" 
  ON public.whatsapp_message_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- Seul le serveur Node.js (service_role) peut insérer des logs d'envoi
DROP POLICY IF EXISTS "wa_logs_insert_service" ON public.whatsapp_message_logs;
CREATE POLICY "wa_logs_insert_service" 
  ON public.whatsapp_message_logs FOR INSERT 
  WITH CHECK (true);
