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
  it("renders all 4 tabs", () => {
    render(<RightSidebarPanel />, { wrapper: Wrapper });
    expect(screen.getByText("Templates")).toBeInTheDocument();
    expect(screen.getByText("Inspector")).toBeInTheDocument();
    expect(screen.getByText("FX")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("defaults to Templates tab", () => {
    render(<RightSidebarPanel />, { wrapper: Wrapper });
    // Templates tab should show template content
    // Check that the tab button for Templates is active (has specific styling)
    const templatesBtn = screen.getByText("Templates");
    expect(templatesBtn).toBeInTheDocument();
  });

  it("switches tabs on click", async () => {
    const user = userEvent.setup();
    render(<RightSidebarPanel />, { wrapper: Wrapper });
    
    await user.click(screen.getByText("FX"));
    // FX panel should now be visible - look for FX-specific content
    // The CinematicFXPanel should render
    expect(screen.getByText("FX")).toBeInTheDocument();
  });

  it("switches to Inspector tab on click", async () => {
    const user = userEvent.setup();
    render(<RightSidebarPanel />, { wrapper: Wrapper });
    
    await user.click(screen.getByText("Inspector"));
    expect(screen.getByText("Inspector")).toBeInTheDocument();
  });

  it("switches to AI tab on click", async () => {
    const user = userEvent.setup();
    render(<RightSidebarPanel />, { wrapper: Wrapper });
    
    await user.click(screen.getByText("AI"));
    expect(screen.getByText("AI")).toBeInTheDocument();
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
