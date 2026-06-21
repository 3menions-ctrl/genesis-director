/**
 * classifyFailure — map raw stitcher error messages to the
 * render_failures.classification enum.
 *
 * Extracted to its own module so the test harness can import + verify
 * the mapping without spinning up the Deno edge function (which has
 * `serve()` at the top of its module).
 *
 * The enum is intentionally tight. New error shapes default to
 * "unknown" so the admin dashboard's histogram surfaces them as a
 * growing bucket; that's the signal to extend the enum in the next
 * migration rather than silently sweep the new failure mode under
 * "unknown" forever.
 */

export type FailureClassification =
  | "input_invalid"
  | "auth_revalidate"
  | "replicate_submit"
  | "replicate_failed"
  | "replicate_timeout"
  | "byte_check_fail"
  | "persistence_fail"
  | "sign_url_fail"
  | "unknown";

export function classifyFailure(msg: string): FailureClassification {
  const m = msg.toLowerCase();
  if (m.startsWith("either projectid") ||
      m.includes("sessionid is required") ||
      m.includes("project_not_found") ||
      m.includes("transitionduration")) return "input_invalid";
  if (m.startsWith("replicate_submit")) return "replicate_submit";
  if (m.startsWith("replicate_timeout")) return "replicate_timeout";
  if (m.startsWith("replicate_") &&
      (m.includes("failed") || m.includes("canceled"))) return "replicate_failed";
  if (m.startsWith("replicate_output_") ||
      m.includes("not_mp4") || m.includes("too_small")) return "byte_check_fail";
  if (m.startsWith("upload_failed") || m.includes("persist")) return "persistence_fail";
  if (m.startsWith("sign_failed")) return "sign_url_fail";
  if (m.includes("auth") && m.includes("expir")) return "auth_revalidate";
  return "unknown";
}
