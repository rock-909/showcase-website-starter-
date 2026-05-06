import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const LEAD_FAMILY_TEST_FILES = [
  "tests/integration/api/lead-family-contract.test.ts",
  "tests/integration/api/lead-family-protection.test.ts",
  "src/app/api/inquiry/__tests__/route.test.ts",
  "tests/integration/api/subscribe.test.ts",
] as const;

function readRepoFile(relativePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo fixture files by relative path
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("proof lane contract", () => {
  it("keeps the lightweight review lanes wired into ci-local and release proof", () => {
    const packageJson = readRepoFile("package.json");
    const ciLocalScript = readRepoFile("scripts/ci-local.sh");
    const releaseProofScript = readRepoFile("scripts/release-proof.sh");

    expect(packageJson).toContain('"review:docs-truth"');
    expect(packageJson).toContain('"review:cf:official-compare"');
    expect(packageJson).toContain('"review:cf:official-compare:generated"');
    expect(packageJson).toContain('"review:cf:official-compare:source"');
    expect(packageJson).toContain('"review:derivative-readiness"');

    expect(ciLocalScript).toContain("pnpm review:docs-truth");
    expect(ciLocalScript).toContain("pnpm review:derivative-readiness");
    expect(ciLocalScript).toContain("pnpm review:cf:official-compare:source");
    expect(
      ciLocalScript.indexOf("pnpm review:cf:official-compare:source"),
    ).toBeLessThan(ciLocalScript.indexOf("# 构建检查"));

    expect(releaseProofScript).toContain("pnpm review:docs-truth");
    expect(releaseProofScript).toContain(
      "pnpm review:cf:official-compare:source",
    );
    expect(releaseProofScript).toContain(
      "pnpm review:cf:official-compare:generated",
    );
    expect(
      releaseProofScript.indexOf("pnpm review:cf:official-compare:source"),
    ).toBeLessThan(releaseProofScript.indexOf("pnpm deploy:cf:dry-run"));
    expect(
      releaseProofScript.indexOf("pnpm review:cf:official-compare:generated"),
    ).toBeGreaterThan(releaseProofScript.indexOf("pnpm deploy:cf:dry-run"));
    expect(releaseProofScript).toContain("pnpm review:derivative-readiness");
  });

  it("documents dirty-worktree targeted proof separately from clean-branch full proof", () => {
    const qualityProofLevels = readRepoFile(
      "docs/guides/QUALITY-PROOF-LEVELS.md",
    );
    const releaseProofRunbook = readRepoFile(
      "docs/guides/RELEASE-PROOF-RUNBOOK.md",
    );

    expect(qualityProofLevels).toContain("dirty worktree");
    expect(qualityProofLevels).toContain("targeted proof");
    expect(qualityProofLevels).toContain("clean branch");

    expect(releaseProofRunbook).toContain("dirty worktree");
    expect(releaseProofRunbook).toContain("targeted proof");
    expect(releaseProofRunbook).toContain("clean branch");
    expect(releaseProofRunbook).toContain("ci:local:quick");
  });

  it("keeps the lead-family proof lane aligned with route-level replay coverage", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const leadFamilyScript = packageJson.scripts["test:lead-family"];

    expect(leadFamilyScript).toBeTruthy();
    for (const testFile of LEAD_FAMILY_TEST_FILES) {
      expect(leadFamilyScript).toContain(testFile);
    }
  });

  it("does not imply deployed GET smoke proves real lead submission", () => {
    const releaseProofScript = readRepoFile("scripts/release-proof.sh");
    const releaseProofRunbook = readRepoFile(
      "docs/guides/RELEASE-PROOF-RUNBOOK.md",
    );

    expect(releaseProofScript).toContain("test:e2e:post-deploy");
    expect(releaseProofScript).toContain("Airtable");
    expect(releaseProofScript).toContain("manual launch gate");
    expect(releaseProofRunbook).toContain("test:e2e:post-deploy");
    expect(releaseProofRunbook).toContain("manual launch gate");
  });

  it("keeps phase and mutation lanes out of the public package command surface", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const releaseProofScript = readRepoFile("scripts/release-proof.sh");
    const scriptNames = Object.keys(packageJson.scripts);

    for (const stableCommand of [
      "build:cf",
      "preview:cf",
      "deploy:cf",
      "deploy:cf:preview",
      "deploy:cf:dry-run",
      "smoke:cf:preview",
      "smoke:cf:deploy",
      "website:build:cf",
    ]) {
      expect(packageJson.scripts[stableCommand]).toBeTruthy();
    }

    expect(
      scriptNames.filter((name) => name.startsWith("test:mutation")),
    ).toEqual([]);
    expect(packageJson.scripts["review:mutation:critical"]).toBeUndefined();
    expect(scriptNames.filter((name) => name.includes(":phase"))).toEqual([]);
    expect(releaseProofScript).toContain("pnpm deploy:cf:dry-run");
    expect(releaseProofScript).not.toContain("deploy:cf:phase6");
  });

  it("keeps starter readiness proof commands available after grouped guardrail runner removal", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const groupedRunnerExists = fs.existsSync(
      path.join(REPO_ROOT, "scripts/run-all-guardrails-review.js"),
    );

    expect(packageJson.scripts["brand:check"]).toBe(
      "node scripts/brand-check.mjs",
    );
    expect(packageJson.scripts["content:check"]).toBe(
      "pnpm content:slug-check && pnpm validate:translations",
    );
    expect(packageJson.scripts["component:check"]).toBe(
      "pnpm component:governance:test && pnpm component:governance && pnpm storybook:build",
    );
    expect(packageJson.scripts["website:check"]).toBe(
      "pnpm type-check && pnpm lint:check && pnpm test && pnpm build",
    );
    expect(packageJson.scripts["website:build:cf"]).toBe("pnpm build:cf");
    expect(packageJson.scripts["website:content:readiness"]).toBe(
      "node scripts/content-readiness-check.mjs",
    );
    expect(packageJson.scripts["website:review:client-boundary"]).toBe(
      "node scripts/client-boundary-budget.mjs",
    );
    expect(groupedRunnerExists).toBe(false);
    expect(ciWorkflow).toContain("pnpm brand:check");
    expect(ciWorkflow).toContain("pnpm content:check");
    expect(ciWorkflow).toContain("pnpm website:review:client-boundary");
    expect(ciWorkflow).toContain("pnpm website:build:cf");
  });

  it("does not overclaim local contact smoke as real submission proof", () => {
    const contactSmokeSpec = readRepoFile(
      "tests/e2e/contact-form-smoke.spec.ts",
    );
    const playwrightConfig = readRepoFile("playwright.config.ts");

    expect(contactSmokeSpec).not.toContain("应该能够成功提交表单");
    expect(contactSmokeSpec).toContain("完整填写后提交入口可见");
    expect(contactSmokeSpec).toContain("Local smoke");
    expect(contactSmokeSpec).toContain(
      "does not submit to the deployed lead pipeline",
    );

    expect(playwrightConfig).toContain("NEXT_PUBLIC_TEST_MODE");
    expect(playwrightConfig).toContain("Local E2E proof boundary");
    expect(playwrightConfig).toContain(
      "not real Turnstile or deployed lead proof",
    );
  });

  it("labels lead-family contract proof as auxiliary rather than full-chain proof", () => {
    const contractSpec = readRepoFile(
      "tests/integration/api/lead-family-contract.test.ts",
    );
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const structuralClusters = readRepoFile(
      "docs/guides/STRUCTURAL-CHANGE-CLUSTERS.md",
    );
    const normalizedContractSpec = contractSpec.replace(/\s+/gu, " ");

    expect(contractSpec).toContain(
      "Auxiliary response and observability checks only.",
    );
    expect(normalizedContractSpec).toContain(
      "not full lead-chain protection proof",
    );
    expect(ciWorkflow).toContain("Lead API Family Layered Proof Review");
    expect(ciWorkflow).not.toContain("Lead API Family Contract Review");
    expect(structuralClusters).toContain("auxiliary contract proof");
    expect(structuralClusters).toContain("route-level protection proof");
  });

  it("keeps BC-024 idempotency gap analysis aligned with listed route coverage", () => {
    const behavioralContracts = readRepoFile(
      "docs/specs/behavioral-contracts.md",
    );

    expect(behavioralContracts).toContain(
      "Inquiry route replay is covered in `src/app/api/inquiry/__tests__/route.test.ts`",
    );
    expect(behavioralContracts).toContain(
      "subscribe replay/conflict semantics are covered in `tests/integration/api/subscribe.test.ts`",
    );
    expect(behavioralContracts).not.toContain(
      "Idempotency only tested for contact, not inquiry/subscribe",
    );
    expect(behavioralContracts).toContain(
      "family-wide end-to-end alignment across all lead surfaces",
    );
  });

  it("documents all client-launch catalog, identity, SEO, and legal replacement surfaces", () => {
    const brandSettings = readRepoFile("docs/website/品牌设置.md");
    const replacementChecklist = readRepoFile("docs/website/新项目替换清单.md");
    const qualityProof = readRepoFile("docs/website/quality-proof.md");

    for (const expectedSurface of [
      "src/config/single-site.ts",
      "src/config/website/profile.ts",
      "src/config/website/seo.ts",
      "src/config/single-site-seo.ts",
      "src/config/website/products.ts",
      "src/config/single-site-product-catalog.ts",
      "src/constants/product-specs/**",
      "messages/{locale}/critical.json",
      "messages/{locale}/deferred.json",
      "public/images/products/**",
      "content/pages/{locale}/about.mdx",
      "content/pages/{locale}/contact.mdx",
      "content/pages/{locale}/privacy.mdx",
      "content/pages/{locale}/terms.mdx",
    ]) {
      expect(replacementChecklist).toContain(expectedSurface);
    }

    expect(brandSettings).toContain("src/config/single-site.ts");
    expect(brandSettings).toContain("src/config/website/profile.ts");
    expect(brandSettings).toContain("src/config/website/seo.ts");
    expect(brandSettings).toContain("镜像层");
    expect(brandSettings).not.toContain("品牌信息集中在 `src/config/website/`");

    expect(replacementChecklist).toContain("client launch");
    expect(replacementChecklist).toContain("starter 示例");
    expect(replacementChecklist).toContain("SEO");
    expect(replacementChecklist).toContain("法务");
    expect(qualityProof).toContain("src/config/single-site.ts");
    expect(qualityProof).toContain("src/config/website/profile.ts");
    expect(qualityProof).toContain("src/config/website/seo.ts");
    expect(qualityProof).toContain("src/config/single-site-seo.ts");
    expect(qualityProof).toContain("src/config/single-site-product-catalog.ts");
    expect(qualityProof).toContain("product specs");
    expect(qualityProof).toContain("catalog truth");
    expect(qualityProof).toContain("crawl / indexing truth");
    expect(qualityProof).toContain("canonical authoring source");
    expect(qualityProof).toContain("starter 示例可以存在于 starter 仓库");
    expect(qualityProof).toContain("pnpm validate:launch-content");
  });

  it("keeps ai-smell repo profile pointed at current critical surfaces", () => {
    const repoProfile = readRepoFile(
      ".codex/skills/ai-smell-audit/references/repo-profile.md",
    );

    expect(repoProfile).toContain("src/app/api/contact/**");
    expect(repoProfile).toContain("src/lib/actions/contact.ts");
    expect(repoProfile).toContain("src/app/api/inquiry/route.ts");
    expect(repoProfile).toContain("src/app/api/subscribe/route.ts");
    expect(repoProfile).toContain("src/app/api/verify-turnstile/route.ts");
    expect(repoProfile).toContain("src/lib/turnstile.ts");
    expect(repoProfile).toContain("src/lib/lead-pipeline/**");
    expect(repoProfile).toContain("src/config/single-site-product-catalog.ts");
    expect(repoProfile).toContain("src/constants/product-specs/**");
    expect(repoProfile).toContain("tests/e2e/contact-form-smoke.spec.ts");
    expect(repoProfile).toContain("tests/e2e/smoke/post-deploy-form.spec.ts");
    expect(repoProfile).toContain("playwright.config.ts");
    expect(repoProfile).toContain("docs/website/quality-proof.md");
    expect(repoProfile).not.toContain("src/app/actions.ts");
    expect(repoProfile).not.toContain(
      "src/components/products/product-inquiry-form",
    );
    expect(repoProfile).not.toContain("src/lib/idempotency/**");
  });

  it("records closure for every 2026-05-03 ai-smell finding", () => {
    const closure = readRepoFile(
      "docs/audits/ai-smell-remediation-20260503.md",
    );
    const rootAuditReportExists = fs.existsSync(
      path.join(REPO_ROOT, "audit-report-20260503.md"),
    );
    const rootAuditSummaryExists = fs.existsSync(
      path.join(REPO_ROOT, "audit-owner-summary-20260503.md"),
    );

    for (const findingId of [
      "F-S21-001",
      "F-S21-002",
      "F-S28-001",
      "F-S23-001",
      "F-S25-001",
      "F-S27-001",
      "F-S31-001",
      "F-S32-001",
      "F-S30-001",
    ]) {
      expect(closure).toContain(findingId);
    }

    expect(closure).toContain("Public Demo Starter Site is out of scope");
    expect(closure).toContain("docs/audits/audit-report-20260503.md");
    expect(rootAuditReportExists).toBe(false);
    expect(rootAuditSummaryExists).toBe(false);
    expect(closure).toContain("Fresh verification");
    expect(closure).toContain(
      "| Finding | Changed files | Closure method | Verification | Remaining boundary |",
    );
    expect(closure).toContain("pnpm validate:launch-content");
    expect(closure).toContain("scripts/validate-production-config.ts");
    expect(closure).toContain("tests/e2e/contact-form-smoke.spec.ts");
    expect(closure).toContain("playwright.config.ts");
  });
});
