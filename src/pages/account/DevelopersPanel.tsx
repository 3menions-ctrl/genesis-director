/**
 * DevelopersPanel — Account → Developers tab. Wraps the existing
 * Developers page content so the API/webhook surface lives alongside
 * the rest of the personal-account tabs. The /developers standalone
 * route now redirects here.
 */
import Developers from "@/pages/Developers";

export default function DevelopersPanel() {
  return <Developers />;
}
