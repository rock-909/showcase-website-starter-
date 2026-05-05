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
  name: "Showcase Website Starter",
  legalName: "Showcase Website Starter",
  tagline: "Public demo starter for launch-ready showcase websites.",
  domain: "example.com",
  email: "starter-contact@example.com",
  phone: "+1 000 000 0000",
  address: "Replace before launch",
  foundedYear: 2020,
  socialLinks: {
    linkedin: "https://www.linkedin.com/company/example",
    x: "https://x.com/example",
  },
};
