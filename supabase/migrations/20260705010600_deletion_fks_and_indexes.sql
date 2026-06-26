-- M16 / audit D39,D41: unblock account deletion + add hot-path indexes.
--
-- D39: 18 FKs reference auth.users with ON DELETE NO ACTION, none cleaned by
--   delete-user-account, so the final auth.admin.deleteUser() hits a RESTRICT
--   and the account is left half-deleted. Re-point each to a non-blocking
--   action: SET NULL for actor references (preserve the row, null the actor),
--   CASCADE for the user's own content, drop NOT NULL where SET NULL needs it.
-- D41: add missing indexes on hot/unbounded columns (DM threads, ledger by
--   project, clip sweeps).

-- ── SET NULL: nullable actor references ──
ALTER TABLE public.conversations               DROP CONSTRAINT conversations_created_by_fkey,
  ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_character_castings  DROP CONSTRAINT genesis_character_castings_approved_by_fkey,
  ADD CONSTRAINT genesis_character_castings_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_continuity_anchors  DROP CONSTRAINT genesis_continuity_anchors_established_by_fkey,
  ADD CONSTRAINT genesis_continuity_anchors_established_by_fkey FOREIGN KEY (established_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_eras                DROP CONSTRAINT genesis_eras_created_by_fkey,
  ADD CONSTRAINT genesis_eras_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_final_assembly      DROP CONSTRAINT genesis_final_assembly_assembled_by_fkey,
  ADD CONSTRAINT genesis_final_assembly_assembled_by_fkey FOREIGN KEY (assembled_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_locations           DROP CONSTRAINT genesis_locations_created_by_fkey,
  ADD CONSTRAINT genesis_locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_preset_characters   DROP CONSTRAINT genesis_preset_characters_cast_by_fkey,
  ADD CONSTRAINT genesis_preset_characters_cast_by_fkey FOREIGN KEY (cast_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_scene_clips         DROP CONSTRAINT genesis_scene_clips_submitted_by_fkey,
  ADD CONSTRAINT genesis_scene_clips_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_scene_clips         DROP CONSTRAINT genesis_scene_clips_reviewed_by_fkey,
  ADD CONSTRAINT genesis_scene_clips_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_screenplay          DROP CONSTRAINT genesis_screenplay_created_by_fkey,
  ADD CONSTRAINT genesis_screenplay_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_story_arcs          DROP CONSTRAINT genesis_story_arcs_created_by_fkey,
  ADD CONSTRAINT genesis_story_arcs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_story_connections   DROP CONSTRAINT genesis_story_connections_approved_by_fkey,
  ADD CONSTRAINT genesis_story_connections_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.system_config               DROP CONSTRAINT system_config_updated_by_fkey,
  ADD CONSTRAINT system_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles                  DROP CONSTRAINT user_roles_granted_by_fkey,
  ADD CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── drop NOT NULL + SET NULL: authorship columns that must survive deletion ──
ALTER TABLE public.admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_admin_id_fkey,
  ADD CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.genesis_lore ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.genesis_lore DROP CONSTRAINT genesis_lore_created_by_fkey,
  ADD CONSTRAINT genesis_lore_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── CASCADE: the user's own content goes with the account ──
ALTER TABLE public.genesis_videos      DROP CONSTRAINT genesis_videos_user_id_fkey,
  ADD CONSTRAINT genesis_videos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.genesis_video_votes DROP CONSTRAINT genesis_video_votes_user_id_fkey,
  ADD CONSTRAINT genesis_video_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── D41: hot-path indexes ──
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON public.direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_project ON public.credit_transactions (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_clips_status_created ON public.video_clips (status, created_at DESC);
