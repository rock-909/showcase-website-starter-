export interface WebsiteProfile {
  readonly name: string;
  readonly legalName: string;
  readonly tagline: string;
  readonly domain: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly foundedYear: number;
  readonly socialLinks: {
    readonly linkedin: string;
    readonly x: string;
  };
}

export const websiteProfile: WebsiteProfile = {
  name: "Example Showcase Company",
  legalName: "Example Showcase Company Ltd.",
  tagline: "Product and service presentation for serious buyers.",
  domain: "example.com",
  email: "sales@example.com",
  phone: "+1 000 000 0000",
  address: "Example Business Park, Example City",
  foundedYear: 2020,
  socialLinks: {
    linkedin: "https://www.linkedin.com/company/example",
    x: "https://x.com/example",
  },
};
