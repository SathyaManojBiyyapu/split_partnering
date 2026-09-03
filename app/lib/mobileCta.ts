/**
 * Mobile floating-CTA coordination.
 *
 * Some pages render their own `.sticky-bottom-cta` bottom bar on mobile
 * (≤640px). On those pages the global floating "Find Partners" pill is
 * redundant, and the floating support button would otherwise sit on top of
 * the bar. This helper lets those floating elements coordinate with the
 * page-level bar so nothing overlaps on small screens.
 */
const STICKY_CTA_ROUTES = [
  "/categories",
  "/collaborators",
  "/dashboard",
  "/find-partners",
  "/offers",
];

export function isStickyCtaPage(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true; // landing page has its own sticky CTA
  return STICKY_CTA_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}