import { SINGLE_SITE_ROUTE_HREFS } from "@/config/single-site-links";
import type { SiteNavigationItem } from "@/config/site-types";

export type { SiteNavigationItem } from "@/config/site-types";

export const SINGLE_SITE_NAVIGATION: SiteNavigationItem[] = [
  {
    key: "home",
    href: SINGLE_SITE_ROUTE_HREFS.home,
    translationKey: "navigation.home",
  },
  {
    key: "products",
    href: SINGLE_SITE_ROUTE_HREFS.products,
    translationKey: "navigation.products",
  },
  {
    key: "customProject",
    href: SINGLE_SITE_ROUTE_HREFS.customProject,
    translationKey: "navigation.customProject",
  },
  {
    key: "about",
    href: SINGLE_SITE_ROUTE_HREFS.about,
    translationKey: "navigation.about",
  },
  {
    key: "contact",
    href: SINGLE_SITE_ROUTE_HREFS.contact,
    translationKey: "navigation.contact",
  },
];
