import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { EditorLoadingScreen } from "@/components/editor/EditorLoadingScreen";
import { EditorErrorScreen } from "@/components/editor/EditorErrorScreen";
import { CustomTimelineProvider } from "@/hooks/useCustomTimeline";
import { EditorChrome } from "@/components/editor/EditorChrome";

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
        const browserRenderModule = await import(/* @vite-ignore */ moduleName);

        if (!cancelled) {
          setMod(browserRenderModule);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Browser render module not available:", err);
          // Non-fatal — editor works without WebCodecs export
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
  const navigate = useNavigate();
  const { mod: browserRender, loading } = useBrowserRenderModule();

  if (loading) return <EditorLoadingScreen />;

  return (
    <CustomTimelineProvider>
      <EditorChrome
        useBrowserRenderer={browserRender?.useBrowserRenderer}
        navigate={navigate}
      />
    </CustomTimelineProvider>
  );
}
