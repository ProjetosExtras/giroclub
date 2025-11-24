CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cpf TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  is_admin boolean DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own profile' AND polrelid = 'public.profiles'::regclass) THEN
    CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own profile' AND polrelid = 'public.profiles'::regclass) THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own profile' AND polrelid = 'public.profiles'::regclass) THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  current_cycle INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 5,
  deposit_amount NUMERIC(12,2) DEFAULT 100.00,
  weekly_payment NUMERIC(12,2) DEFAULT 80.00,
  payout_amount NUMERIC(12,2) DEFAULT 300.00,
  service_fee_percent NUMERIC(5,2) DEFAULT 5.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS set_updated_at_groups ON public.groups;
CREATE TRIGGER set_updated_at_groups
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view groups they are members of' AND polrelid = 'public.groups'::regclass) THEN
    CREATE POLICY "Users can view groups they are members of"
      ON public.groups FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = groups.id AND gm.profile_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can create groups' AND polrelid = 'public.groups'::regclass) THEN
    CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Group creators can update their groups' AND polrelid = 'public.groups'::regclass) THEN
    CREATE POLICY "Group creators can update their groups" ON public.groups FOR UPDATE USING (auth.uid() = created_by);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  has_received BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, profile_id),
  UNIQUE(group_id, position)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view members of their groups' AND polrelid = 'public.group_members'::regclass) THEN
    CREATE POLICY "Users can view members of their groups"
      ON public.group_members FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.profile_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Group creators can add members' AND polrelid = 'public.group_members'::regclass) THEN
    CREATE POLICY "Group creators can add members"
      ON public.group_members FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.groups WHERE groups.id = group_members.group_id AND groups.created_by = auth.uid())
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.group_members(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  pix_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deposits' AND column_name = 'mp_payment_id') THEN
    ALTER TABLE public.deposits ADD COLUMN mp_payment_id bigint;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deposits' AND column_name = 'mp_status') THEN
    ALTER TABLE public.deposits ADD COLUMN mp_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deposits' AND column_name = 'mp_status_detail') THEN
    ALTER TABLE public.deposits ADD COLUMN mp_status_detail text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deposits' AND column_name = 'mp_amount') THEN
    ALTER TABLE public.deposits ADD COLUMN mp_amount numeric(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deposits' AND column_name = 'mp_confirmed_at') THEN
    ALTER TABLE public.deposits ADD COLUMN mp_confirmed_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deposits_mp_payment_id
ON public.deposits (mp_payment_id) WHERE mp_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.deposits_set_confirmed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
    NEW.mp_confirmed_at := COALESCE(NEW.mp_confirmed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deposits_set_confirmed_at ON public.deposits;
CREATE TRIGGER trg_deposits_set_confirmed_at
BEFORE UPDATE ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.deposits_set_confirmed_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view deposits in their groups' AND polrelid = 'public.deposits'::regclass) THEN
    CREATE POLICY "Users can view deposits in their groups"
      ON public.deposits FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = deposits.group_id AND gm.profile_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can create deposits for themselves' AND polrelid = 'public.deposits'::regclass) THEN
    CREATE POLICY "Users can create deposits for themselves"
      ON public.deposits FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.id = deposits.member_id AND gm.profile_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update own deposits' AND polrelid = 'public.deposits'::regclass) THEN
    CREATE POLICY "Users can update own deposits"
      ON public.deposits FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.id = deposits.member_id AND gm.profile_id = auth.uid())
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  payer_id UUID REFERENCES public.group_members(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'late', 'failed')),
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view payments in their groups' AND polrelid = 'public.payments'::regclass) THEN
    CREATE POLICY "Users can view payments in their groups"
      ON public.payments FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = payments.group_id AND gm.profile_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can create their own payments' AND polrelid = 'public.payments'::regclass) THEN
    CREATE POLICY "Users can create their own payments"
      ON public.payments FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.id = payments.payer_id AND gm.profile_id = auth.uid())
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  full_name text,
  cpf text,
  amount numeric(12,2),
  status text CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);
ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS set_updated_at_loan_requests ON public.loan_requests;
CREATE TRIGGER set_updated_at_loan_requests
  BEFORE UPDATE ON public.loan_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert own loan requests' AND polrelid = 'public.loan_requests'::regclass) THEN
    CREATE POLICY "Users can insert own loan requests" ON public.loan_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view own loan requests' AND polrelid = 'public.loan_requests'::regclass) THEN
    CREATE POLICY "Users can view own loan requests" ON public.loan_requests FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update own loan requests' AND polrelid = 'public.loan_requests'::regclass) THEN
    CREATE POLICY "Users can update own loan requests" ON public.loan_requests FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can view all loan requests' AND polrelid = 'public.loan_requests'::regclass) THEN
    CREATE POLICY "Admins can view all loan requests"
      ON public.loan_requests FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can update all loan requests' AND polrelid = 'public.loan_requests'::regclass) THEN
    CREATE POLICY "Admins can update all loan requests"
      ON public.loan_requests FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
      );
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc', 'kyc', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can upload own kyc' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Users can upload own kyc"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'kyc' AND name LIKE 'profiles/' || auth.uid() || '/%');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can read own kyc' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Users can read own kyc"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'kyc' AND name LIKE 'profiles/' || auth.uid() || '/%');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can read all kyc' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Admins can read all kyc"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'kyc' AND EXISTS (
          SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      );
  END IF;
END $$;