export interface WebsiteProductCategory {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly image: string;
}

export const websiteProductCategories: readonly WebsiteProductCategory[] = [
  {
    id: "product-category-a",
    label: "Product Category A",
    description: "Example product category for a showcase website starter.",
    image: "/images/products/sample-product.svg",
  },
  {
    id: "service-category-b",
    label: "Service Category B",
    description: "Example service category for companies that sell expertise.",
    image: "/images/products/sample-product.svg",
  },
];
