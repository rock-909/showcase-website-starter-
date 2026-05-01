import { describe, expect, it } from "vitest";
import {
  classifyInlineScript,
  extractScriptTypeAttr,
  hasExecutableScriptType,
} from "../../../scripts/csp/check-inline-scripts";

describe("CSP inline script proof helpers", () => {
  it("extracts script type attributes with valid HTML whitespace", () => {
    expect(extractScriptTypeAttr('type="application/ld+json"')).toBe(
      "application/ld+json",
    );
    expect(extractScriptTypeAttr('type = "application/ld+json"')).toBe(
      "application/ld+json",
    );
  });

  it("does not classify non-type attributes as JSON-LD", () => {
    const script = {
      attrs: 'data-kind="application/ld+json"',
      body: '{"@context":"https://schema.org"}',
    };

    expect(classifyInlineScript(script)).not.toBe("project-json-ld");
    expect(hasExecutableScriptType(script)).toBe(true);
  });

  it("treats JSON-LD as a non-executable data block", () => {
    const script = {
      attrs: 'type="application/ld+json"',
      body: '{"@context":"https://schema.org"}',
    };

    expect(classifyInlineScript(script)).toBe("project-json-ld");
    expect(hasExecutableScriptType(script)).toBe(false);
  });

  it.each([
    ["missing type", ""],
    ["module", 'type="module"'],
    ["javascript", 'type="application/javascript"'],
  ])("treats %s inline script as executable", (_label, attrs) => {
    expect(hasExecutableScriptType({ attrs, body: "console.log(1)" })).toBe(
      true,
    );
  });
});
