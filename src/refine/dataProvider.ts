/**
 * Custom Refine Data Provider for admin panel.
 * Wraps Supabase RPCs and direct table queries used by the admin.
 */
import type { DataProvider } from "@refinedev/core";
import { dataProvider as supabaseDataProvider } from "@refinedev/supabase";
import { supabase } from "@/integrations/supabase/client";

const baseProvider = supabaseDataProvider(supabase);

const getPagination = (pagination: any) => {
  const current = pagination?.current ?? pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? pagination?.perPage ?? 25;
  return { current, pageSize };
};

export const refineDataProvider: DataProvider = {
  ...baseProvider,

  getList: async (params: any) => {
    const resource = params.resource;
    const { current, pageSize } = getPagination(params.pagination);
    const filters = params.filters || [];
    const searchFilter = filters.find((f: any) => f.field === "q");
    const search = searchFilter ? String(searchFilter.value) : null;

    if (resource === "admin_users") {
      const { data, error } = await supabase.rpc("admin_list_users", {
        p_limit: pageSize,
        p_offset: (current - 1) * pageSize,
        p_search: search,
      });
      if (error) throw error;
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      return { data: (data || []) as any[], total: count || (data?.length ?? 0) };
    }

    if (resource === "admin_projects") {
      const statusFilter = filters.find((f: any) => f.field === "status");
      const { data, error } = await supabase.rpc("admin_list_projects", {
        p_limit: pageSize,
        p_offset: (current - 1) * pageSize,
        p_search: search,
        p_status: statusFilter ? String(statusFilter.value) : null,
      });
      if (error) throw error;
      const { count } = await supabase.from("movie_projects").select("id", { count: "exact", head: true });
      return { data: (data || []) as any[], total: count || (data?.length ?? 0) };
    }

    if (resource === "admin_audit_log") {
      const { data, error, count } = await supabase
        .from("admin_audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((current - 1) * pageSize, current * pageSize - 1);
      if (error) throw error;
      return { data: (data || []) as any[], total: count || 0 };
    }

    if (resource === "credit_transactions") {
      let query = supabase
        .from("credit_transactions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((current - 1) * pageSize, current * pageSize - 1);
      const typeFilter = filters.find((f: any) => f.field === "transaction_type");
      if (typeFilter) query = query.eq("transaction_type", typeFilter.value);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data || []) as any[], total: count || 0 };
    }

    if (resource === "support_messages") {
      const { data, error, count } = await supabase
        .from("support_messages")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((current - 1) * pageSize, current * pageSize - 1);
      if (error) throw error;
      return { data: (data || []) as any[], total: count || 0 };
    }

    return baseProvider.getList(params);
  },

  getOne: async (params: any) => {
    const resource = params.resource;
    if (resource === "admin_users") {
      const { data, error } = await supabase.rpc("admin_view_user_profile", {
        p_target_user_id: params.id as string,
      });
      if (error) throw error;
      return { data: (data as any) || {} };
    }
    return baseProvider.getOne(params);
  },
} as DataProvider;
