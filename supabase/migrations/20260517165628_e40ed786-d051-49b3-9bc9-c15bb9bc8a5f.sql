UPDATE public.movie_projects
SET status = 'cancelled',
    last_error = 'Auto-cancelled: blocked by missing balance_after column (now fixed). Please start a new generation.'
WHERE status = 'payment_failed'
  AND last_error = 'Credit deduction failed';