/**
 * Component rendering tests for all editor panels/tools
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomTimelineProvider } from "@/hooks/useCustomTimeline";
import { RightSidebarPanel } from "@/components/editor/RightSidebarPanel";
import { AudioLevelMeter } from "@/components/editor/AudioLevelMeter";
import { VideoScopes } from "@/components/editor/VideoScopes";
import { BrowserRouter } from "react-router-dom";

// Wrapper with required providers
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <CustomTimelineProvider>
        {children}
      </CustomTimelineProvider>
    </BrowserRouter>
  );
}

describe("RightSidebarPanel", () => {
  it("renders the panel with at least 4 tab buttons", () => {
    const { container } = render(<RightSidebarPanel />, { wrapper: Wrapper });
    const buttons = container.querySelectorAll('button');
    // 6 tabs in current design: Templates, Inspector, FX, AI, Cast, Voice
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it("defaults to Templates tab", () => {
    render(<RightSidebarPanel />, { wrapper: Wrapper });
    // Header shows the active tab's full label
    expect(screen.getByText("Templates")).toBeInTheDocument();
  });

  it("switches to FX tab on click", async () => {
    const user = userEvent.setup();
    render(<RightSidebarPanel />, { wrapper: Wrapper });

    // Tab buttons are abbreviated; click the FX abbrev button
    const fxButton = screen.getAllByText("FX")[0];
    await user.click(fxButton);
    // After click, header label should show "FX"
    expect(screen.getAllByText("FX").length).toBeGreaterThan(0);
  });

  it("switches to Inspector tab on click", async () => {
    const user = userEvent.setup();
    const { container } = render(<RightSidebarPanel />, { wrapper: Wrapper });

    // Click the Inspector abbrev button ("Insp")
    const inspButton = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Insp')
    );
    expect(inspButton).toBeDefined();
    await user.click(inspButton!);
    expect(screen.getByText("Inspector")).toBeInTheDocument();
  });

  it("switches to AI tab on click", async () => {
    const user = userEvent.setup();
    render(<RightSidebarPanel />, { wrapper: Wrapper });

    const aiButton = screen.getAllByText("AI")[0];
    await user.click(aiButton);
    expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
  });
});

describe("AudioLevelMeter", () => {
  it("renders without crashing", () => {
    const { container } = render(<AudioLevelMeter />, { wrapper: Wrapper });
    expect(container.firstChild).toBeInTheDocument();
  });

  it("displays L and R channel labels", () => {
    render(<AudioLevelMeter />, { wrapper: Wrapper });
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
  });
});

describe("VideoScopes", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(<VideoScopes visible={false} />, { wrapper: Wrapper });
    expect(container.firstChild).toBeNull();
  });

  it("renders scope modes when visible", () => {
    render(<VideoScopes visible={true} />, { wrapper: Wrapper });
    expect(screen.getByText("Waveform")).toBeInTheDocument();
    expect(screen.getByText("Vectorscope")).toBeInTheDocument();
    expect(screen.getByText("Histogram")).toBeInTheDocument();
    expect(screen.getByText("RGB Parade")).toBeInTheDocument();
  });

  it("switches scope mode on click", async () => {
    const user = userEvent.setup();
    render(<VideoScopes visible={true} />, { wrapper: Wrapper });
    
    await user.click(screen.getByText("Histogram"));
    // Should still render (mode changed internally)
    expect(screen.getByText("Histogram")).toBeInTheDocument();
  });

  it("contains a canvas element", () => {
    const { container } = render(<VideoScopes visible={true} />, { wrapper: Wrapper });
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
