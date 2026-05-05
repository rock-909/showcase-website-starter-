export interface WebsiteNavigationItem {
  readonly labelKey: string;
  readonly href: string;
}

export const websiteNavigation: readonly WebsiteNavigationItem[] = [
  { labelKey: "navigation.home", href: "/" },
  { labelKey: "navigation.products", href: "/products" },
  { labelKey: "navigation.blog", href: "/blog" },
  { labelKey: "navigation.about", href: "/about" },
];
