-- =====================================================
-- 1. STORAGE: Remove broad SELECT (LIST) policies on public buckets.
-- Direct file access by URL still works (buckets are still public),
-- but anonymous clients can no longer LIST/enumerate bucket contents.
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view casting images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view character references" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view voice tracks" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Final videos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view hoppy images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for temp frames" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for user uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for video thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Scene images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Thumbnails are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "character_refs_public_read" ON storage.objects;
DROP POLICY IF EXISTS "final_videos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "scene_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "temp_frames_public_read" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails_public_read" ON storage.objects;
DROP POLICY IF EXISTS "video_clips_public_read" ON storage.objects;
DROP POLICY IF EXISTS "voice_tracks_public_read" ON storage.objects;

-- =====================================================
-- 2. REVOKE EXECUTE on SECURITY DEFINER functions FROM `anon` and PUBLIC.
-- =====================================================

-- Trigger functions: revoke from everyone
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_gamification()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_follow_admin_on_signup()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_banned_signups()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_credits_balance_change()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_negative_credits()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_low_credits_notification()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_likes_count()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_agent_message_count()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_timeline_activity()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_consent_fields()                FROM PUBLIC, anon, authenticated;

-- RPCs called by authenticated clients: revoke from anon only
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_force_logout_all()                                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_aggregated_stats()                                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_projects(integer, integer, text, text, text, text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_moderate_content(uuid, text, text)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_view_user_profile(uuid)                                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats()                                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_profit_dashboard()                                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.charge_production_credits(uuid, text)                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.charge_production_credits(uuid, text, integer)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.charge_production_credits(uuid, uuid, text)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid, integer)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refund_production_credits(uuid, uuid, text, text)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deactivate_account(text)                                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reactivate_account()                                            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_email_banned(text)                                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_login_rate_limit(text)                                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_login_attempt(text, boolean, text)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_universe_role(uuid, uuid)                                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_universe_member(uuid, uuid)                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid)                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[])                         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_assign_character_voice(uuid, text, uuid, text)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tier_limits(uuid)                                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_generation_checkpoint(uuid)                                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_generation_checkpoint(uuid, integer, integer, jsonb)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.persist_pipeline_context(uuid, jsonb)                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_video_clip(uuid, uuid, integer, text, text, text, text, text, jsonb, text)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atomic_claim_clip(uuid, integer, text)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_generation_lock(uuid, uuid)                             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_credits(uuid, integer)                                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_widget_view_credits(uuid)                                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_signup_analytics()                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_referral_code(text)                                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_api_cost(uuid, text, text, text, integer, integer, integer, text, jsonb)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_session_stamp(uuid, integer)                           FROM PUBLIC, anon;
