import { describe, expect, it } from "vitest";
import { getPageBySlug } from "@/lib/content";

describe("Contact page localized rendering content", () => {
  it("provides Chinese body sections from MDX", async () => {
    const page = await getPageBySlug("contact", "zh");

    expect(page.content).toContain("## 联系方式");
    expect(page.content).toContain("## 响应预期");
  });
});
