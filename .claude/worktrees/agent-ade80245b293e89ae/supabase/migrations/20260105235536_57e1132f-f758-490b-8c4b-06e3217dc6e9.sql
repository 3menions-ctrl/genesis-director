-- Drop the existing foreign key constraint
ALTER TABLE public.production_credit_phases 
DROP CONSTRAINT IF EXISTS production_credit_phases_project_id_fkey;

-- Re-add it with ON DELETE CASCADE so deleting a project also deletes related credit phases
ALTER TABLE public.production_credit_phases 
ADD CONSTRAINT production_credit_phases_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES public.movie_projects(id) 
ON DELETE CASCADE;

-- Also fix api_cost_logs foreign key to cascade on delete
ALTER TABLE public.api_cost_logs 
DROP CONSTRAINT IF EXISTS api_cost_logs_project_id_fkey;

ALTER TABLE public.api_cost_logs 
ADD CONSTRAINT api_cost_logs_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES public.movie_projects(id) 
ON DELETE CASCADE;

-- Also fix credit_transactions foreign key to cascade on delete
ALTER TABLE public.credit_transactions 
DROP CONSTRAINT IF EXISTS credit_transactions_project_id_fkey;

ALTER TABLE public.credit_transactions 
ADD CONSTRAINT credit_transactions_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES public.movie_projects(id) 
ON DELETE SET NULL;