/**
 * AnalyticsTracker — autocaptures a $pageview on every route change.
 * Mount once inside the Router. Renders nothing.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { page } from "@/lib/analytics/track";

export function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    page({ path: location.pathname });
  }, [location.pathname, location.search]);
  return null;
}

export default AnalyticsTracker;
