import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { EditorLoadingScreen } from "@/components/editor/EditorLoadingScreen";
import { EditorErrorScreen } from "@/components/editor/EditorErrorScreen";
import { CustomTimelineProvider } from "@/hooks/useCustomTimeline";
import { EditorChrome } from "@/components/editor/EditorChrome";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { DesktopRecommendedBanner } from "@/components/ui/DesktopRecommendedBanner";

import { usePageMeta } from '@/hooks/usePageMeta';
// Dynamic import — keep browser-render for WebCodecs export
function useBrowserRenderModule() {
  const [mod, setMod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBrowserRenderer = async () => {
      try {
        const moduleName = "@twick/browser-render";
        const result = await Promise.race([
          import(/* @vite-ignore */ moduleName),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
        ]);

        if (!cancelled) {
          setMod(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Browser render module not available:", err);
          setLoading(false);
        }
      }
    };

    loadBrowserRenderer();
    return () => {
      cancelled = true;
    };
  }, []);

  return { mod, loading, error };
}

export default function VideoEditor() {
  usePageMeta({ title: "Editor — Small Bridges", description: "Multi-track timeline editor with templates, transitions, and broadcast-quality export." });

  const navigate = useNavigate();
  const { mod: browserRender, loading } = useBrowserRenderModule();

  if (loading) return <EditorLoadingScreen />;

  return (
    // FoundationShell bare mounts SpineBackdrop and nothing else, so the
    // Editor inherits the canonical one-room atmosphere without the
    // editorial top bar (which would compete with the Editor's own
    // toolbar). EditorChrome renders into the z-10 content layer.
    <FoundationShell bare>
      <CustomTimelineProvider>
        <DesktopRecommendedBanner surface="Editor" />
        <EditorChrome
          useBrowserRenderer={browserRender?.useBrowserRenderer}
          navigate={navigate}
        />
      </CustomTimelineProvider>
    </FoundationShell>
  );
}
