REVOKE EXECUTE ON FUNCTION public.find_api_key_owner(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_api_key_owner(TEXT) TO service_role;