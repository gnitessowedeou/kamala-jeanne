-- ==============================================================================
-- VANDIAS AI - TABLE DU CATALOGUE PRODUITS & SYNCHRONISATION IA
-- Projet Supabase : rcnaebfqtkwwmqdbgkpq
-- ==============================================================================

-- 1. CRÉATION DE LA TABLE DES PRODUITS DU CATALOGUE
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'FCFA',
  image_url TEXT,
  category TEXT,
  variants JSONB DEFAULT '[]'::jsonb,
  stock INTEGER DEFAULT -1,            -- -1 = Illimité (produits digitaux), >= 0 = Stock physique réel
  is_active BOOLEAN DEFAULT true,       -- Vrai = Actif dans le catalogue IA
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour accélérer les requêtes de l'IA WhatsApp et du Dashboard
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_active ON public.products(user_id, is_active);

-- 2. SÉCURISATION ROW LEVEL SECURITY (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Lecture : Chaque commerçant ne voit que son propre catalogue
DROP POLICY IF EXISTS "products_select_own" ON public.products;
CREATE POLICY "products_select_own" 
  ON public.products FOR SELECT 
  USING (auth.uid() = user_id);

-- Insertion : Chaque commerçant ajoute des articles liés à son user_id
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
CREATE POLICY "products_insert_own" 
  ON public.products FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Mise à jour : Chaque commerçant ne modifie que ses articles
DROP POLICY IF EXISTS "products_update_own" ON public.products;
CREATE POLICY "products_update_own" 
  ON public.products FOR UPDATE 
  USING (auth.uid() = user_id);

-- Suppression : Chaque commerçant ne supprime que ses articles
DROP POLICY IF EXISTS "products_delete_own" ON public.products;
CREATE POLICY "products_delete_own" 
  ON public.products FOR DELETE 
  USING (auth.uid() = user_id);

-- ==============================================================================
-- FIN DU SCRIPT CATALOGUE PRODUITS
-- ==============================================================================
