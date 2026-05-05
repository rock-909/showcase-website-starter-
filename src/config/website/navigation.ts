export interface WebsiteNavigationItem {
  readonly labelKey: string;
  readonly href: string;
}

export const websiteNavigation: readonly WebsiteNavigationItem[] = [
  { labelKey: "navigation.home", href: "/" },
  { labelKey: "navigation.capabilities", href: "/capabilities" },
  { labelKey: "navigation.howItWorks", href: "/how-it-works" },
  { labelKey: "navigation.products", href: "/products" },
  { labelKey: "navigation.about", href: "/about" },
  { labelKey: "navigation.contact", href: "/contact" },
];
