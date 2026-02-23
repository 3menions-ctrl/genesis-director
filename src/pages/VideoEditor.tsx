import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { EditorLoadingScreen } from "@/components/editor/EditorLoadingScreen";
import { EditorErrorScreen } from "@/components/editor/EditorErrorScreen";
import "@twick/studio/dist/studio.css";
import "@/styles/apex-studio-overrides.css";

// Dynamic import to avoid 504 bundling timeouts
function useTwickModules() {
  const [modules, setModules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("@twick/studio"),
      import("@twick/browser-render"),
    ])
      .then(([studio, browserRender]) => {
        if (!cancelled) {
          setModules({ studio, browserRender });
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load Twick modules:", err);
          setError(err.message || "Failed to load editor modules");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { modules, loading, error };
}

export default function VideoEditor() {
  const navigate = useNavigate();
  const { modules, loading: modulesLoading, error: loadError } = useTwickModules();

  if (modulesLoading) return <EditorLoadingScreen />;
  if (loadError || !modules) return <EditorErrorScreen error={loadError} />;

  return <StudioShell modules={modules} navigate={navigate} />;
}

function StudioShell({ modules, navigate }: { modules: any; navigate: any }) {
  const {
    TwickStudio,
    LivePlayerProvider,
    TimelineProvider,
    INITIAL_TIMELINE_DATA,
  } = modules.studio;

  return (
    <LivePlayerProvider>
      <TimelineProvider
        contextId="main-editor"
        initialData={INITIAL_TIMELINE_DATA}
        analytics={{ enabled: false }}
      >
        <StudioShellInner modules={modules} navigate={navigate} />
      </TimelineProvider>
    </LivePlayerProvider>
  );
}

// Lazy-import the chrome to keep this file small
import { EditorChrome } from "@/components/editor/EditorChrome";

function StudioShellInner({ modules, navigate }: { modules: any; navigate: any }) {
  return (
    <EditorChrome
      TwickStudio={modules.studio.TwickStudio}
      useBrowserRenderer={modules.browserRender.useBrowserRenderer}
      BrowserMediaManager={modules.studio.BrowserMediaManager}
      useTimelineContext={modules.studio.useTimelineContext}
      setElementColors={modules.studio.setElementColors}
      navigate={navigate}
    />
  );
}
