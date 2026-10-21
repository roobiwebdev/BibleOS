/**
 * SOURCE OF TRUTH KEYWORDS: geoip-country types, GeoIpCountryResult, lookup
 * WHAT:  Minimal typings for the untyped `geoip-country` package (only what the admin router uses).
 * WHERE: referenced by packages/api/src/routers/admin.ts via a triple-slash reference so every
 *        program that type-checks the router (api package and apps/web) sees it.
 */
declare module "geoip-country" {
  export type GeoIpCountryResult = { country: string; name: string };
  const geoip: { lookup(ip: string | number): GeoIpCountryResult | null };
  export default geoip;
}
