/**
 * Render smoke test for the new Horizon command-center overview (/admin index).
 *
 * Mounts the real component in jsdom with a stubbed Supabase client and asserts
 * it (a) renders its live pulse data without throwing and (b) degrades cleanly
 * to the "All clear." signal when the RPC and tables come back empty. This is
 * the verification we can run headlessly; pixel-parity vs the mockup is a
 * separate live-app check.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => {
  const PULSE = {
    users: { total_users: 1234, signups_24h: 12, signups_7d: 80 },
    projects: { total: 500, completed: 420, failed: 3, in_flight: 14, created_24h: 9 },
    credits: { lifetime_grants: 0, lifetime_spend: 0, spend_24h_signed: -5000 },
    support: { open_tickets: 2 },
  };
  const chain: any = {};
  for (const m of ["select", "eq", "in", "order", "limit", "update", "delete", "insert", "single", "maybeSingle", "neq", "gte", "lte", "is", "not", "filter", "range"]) chain[m] = () => chain;
  chain.then = (r: any) => r({ data: [], error: null });
  return {
    supabase: {
      rpc: vi.fn().mockResolvedValue({ data: PULSE, error: null }),
      from: vi.fn(() => chain),
    },
  };
});

import AdminCommandCenter from "@/refine/pages/AdminCommandCenter";

const renderCC = async () => {
  await act(async () => {
    render(<MemoryRouter><AdminCommandCenter /></MemoryRouter>);
  });
};

describe("AdminCommandCenter (Horizon overview)", () => {
  it("renders the command center with live pulse data, without throwing", async () => {
    await renderCC();
    expect(screen.getByText(/TOTAL MEMBERS/i)).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();        // hero metric
    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Hubs")).toBeInTheDocument();
    expect(screen.getByText("People")).toBeInTheDocument();        // hub nav
    expect(screen.getByText(/open support ticket/i)).toBeInTheDocument(); // real signal from pulse
    expect(screen.getByText(/render.* in flight/i)).toBeInTheDocument();  // 14 in-flight signal
  });

  it("degrades to 'All clear.' when the RPC and tables are empty", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: { message: "no rpc" } });
    await renderCC();
    expect(screen.getByText("All clear.")).toBeInTheDocument();
  });
});
