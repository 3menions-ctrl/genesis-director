UPDATE public.profiles
SET
  account_type = 'business',
  account_tier = 'agency',
  display_name = 'Demo Business Owner',
  full_name = 'Demo Business Owner',
  company = 'Apex Demo Studio',
  job_title = 'Creative Director',
  onboarding_completed = true
WHERE email = 'demo-business@apexstudio.ai';