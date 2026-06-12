/**
 * PushNotificationToggle — Settings UI for the OSS web-push subscription.
 *
 * Asks permission on first click, persists the subscription, exposes a
 * disable affordance.
 */
import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensurePushPermission, isPushEnabled, unregisterPush } from "@/lib/webPush";
import { toast } from "sonner";

export function PushNotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isPushEnabled().then(setEnabled);
  }, []);

  const enable = async () => {
    setBusy(true);
    const res = await ensurePushPermission();
    setBusy(false);
    if (res.ok) {
      setEnabled(true);
      toast.success("Push notifications enabled.");
    } else {
      toast.error(res.reason || "Couldn't enable notifications.");
    }
  };

  const disable = async () => {
    setBusy(true);
    await unregisterPush();
    setBusy(false);
    setEnabled(false);
    toast.message("Push notifications disabled.");
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium text-foreground">Push notifications</div>
        <div className="text-xs text-foreground/55 mt-0.5 max-w-md">
          Hear from us about renders, premieres, tips, and watch parties — even
          when the tab isn't open. Browser-native (Web Push API); no Apple or
          Google middlemen.
        </div>
      </div>
      <Button
        type="button"
        variant={enabled ? "default" : "outline"}
        size="sm"
        disabled={busy}
        onClick={enabled ? disable : enable}
        aria-pressed={enabled}
      >
        {busy
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : enabled
            ? <><Bell className="w-4 h-4 mr-2" /> On</>
            : <><BellOff className="w-4 h-4 mr-2" /> Off</>}
      </Button>
    </div>
  );
}
