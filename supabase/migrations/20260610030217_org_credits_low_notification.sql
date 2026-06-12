-- Workspace low-credits notification + email trigger.
--
-- When an organization's credits_balance drops to or below the configured
-- threshold (default 200) we email every admin/owner of the workspace.
-- Idempotent per descent: subsequent updates below the threshold don't
-- re-fire until the org has been topped up past it again.

INSERT INTO public.system_config (key, value, description)
VALUES (
  'beta.org_low_credits_threshold',
  '200'::jsonb,
  'Workspace credit balance at or below which we fire one org_credits_low email per descent.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fire_org_credits_low_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  threshold int;
  last_grant timestamptz;
  has_recent_event boolean;
  admin_record record;
BEGIN
  IF NEW.credits_balance IS NULL OR OLD.credits_balance IS NULL THEN
    RETURN NEW;
  END IF;
  -- Only act on descents.
  IF NEW.credits_balance >= OLD.credits_balance THEN
    RETURN NEW;
  END IF;

  SELECT (value::text)::int INTO threshold
  FROM public.system_config
  WHERE key = 'beta.org_low_credits_threshold';
  IF threshold IS NULL THEN threshold := 200; END IF;

  IF NEW.credits_balance > threshold THEN
    RETURN NEW;
  END IF;

  -- Rate-limit: one event per top-up cycle. We track via org_spend_events
  -- of type 'credit_grant' (the org-level grant marker).
  SELECT MAX(created_at) INTO last_grant
  FROM public.org_spend_events
  WHERE organization_id = NEW.id
    AND event_type = 'credit_grant';

  SELECT EXISTS (
    SELECT 1 FROM public.org_spend_events
    WHERE organization_id = NEW.id
      AND event_type = 'low_credits_notice'
      AND (last_grant IS NULL OR created_at > last_grant)
  ) INTO has_recent_event;
  IF has_recent_event THEN
    RETURN NEW;
  END IF;

  -- Mark that we fired this notice (so we don't re-fire).
  INSERT INTO public.org_spend_events (organization_id, event_type, credits_amount, metadata)
  VALUES (
    NEW.id,
    'low_credits_notice',
    0,
    jsonb_build_object('balance', NEW.credits_balance, 'threshold', threshold)
  );

  -- Email every admin/owner of the workspace.
  FOR admin_record IN
    SELECT p.email, p.display_name, om.user_id
    FROM public.organization_members om
    JOIN public.profiles p ON p.id = om.user_id
    WHERE om.organization_id = NEW.id
      AND om.role IN ('owner', 'admin')
      AND p.email IS NOT NULL
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/send-transactional-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
        ),
        body := jsonb_build_object(
          'template', 'org_credits_low',
          'recipientEmail', admin_record.email,
          'templateData', jsonb_build_object(
            'orgName', NEW.name,
            'balance', NEW.credits_balance,
            'threshold', threshold,
            'recipientName',
              COALESCE(admin_record.display_name, split_part(admin_record.email, '@', 1)),
            'topUpUrl', 'https://apex-studio.ai/workspace/billing'
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- best-effort
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fire_org_credits_low ON public.organizations;
CREATE TRIGGER trg_fire_org_credits_low
AFTER UPDATE OF credits_balance ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.fire_org_credits_low_notification();

COMMENT ON FUNCTION public.fire_org_credits_low_notification IS
  'Fires org_credits_low email to every workspace admin/owner when credits_balance crosses below the configured threshold. Rate-limited to one event per credit_grant cycle.';
