/**
 * ServiceResult Type Tests
 * Verifies discriminated union type safety
 */

import { describe, expect, it } from "vitest";
import {
  createFailure,
  createSuccess,
  DEFAULT_LATENCY,
  isServiceFailure,
  isServiceSuccess,
  type ServiceResult,
} from "../service-result";

describe("ServiceResult", () => {
  describe("createSuccess", () => {
    it("should create a success result with id and latency", () => {
      const result = createSuccess("record-123", 150);

      expect(result.success).toBe(true);
      expect(result.id).toBe("record-123");
      expect(result.latencyMs).toBe(150);
      expect(isServiceSuccess(result)).toBe(true);
      expect(isServiceFailure(result)).toBe(false);
    });

    it("should create success result without id", () => {
      const result = createSuccess(undefined, 100);

      expect(result.success).toBe(true);
      expect(result.id).toBeUndefined();
      expect(result.latencyMs).toBe(100);
    });
  });

  describe("createFailure", () => {
    it("should create a failure result with error and latency", () => {
      const error = new Error("Connection failed");
      const result = createFailure(error, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.latencyMs).toBe(200);
      expect(isServiceFailure(result)).toBe(true);
      expect(isServiceSuccess(result)).toBe(false);
    });
  });

  describe("type narrowing", () => {
    it("should narrow to success type with type guard", () => {
      const result: ServiceResult = createSuccess("id-456", 50);

      if (isServiceSuccess(result)) {
        // TypeScript should know result has 'id' here
        expect(result.id).toBe("id-456");
      } else {
        expect.fail("Expected success result");
      }
    });

    it("should narrow to failure type with type guard", () => {
      const error = new Error("Test error");
      const result: ServiceResult = createFailure(error, 75);

      if (isServiceFailure(result)) {
        // TypeScript should know result has 'error' here
        expect(result.error.message).toBe("Test error");
      } else {
        expect.fail("Expected failure result");
      }
    });
  });

  describe("type guard runtime contracts", () => {
    it("returns false when isServiceSuccess receives a failure result", () => {
      expect(isServiceSuccess(createFailure(new Error("fail"), 10))).toBe(
        false,
      );
    });

    it("returns false when isServiceFailure receives a success result", () => {
      expect(isServiceFailure(createSuccess("ok", 10))).toBe(false);
    });
  });

  describe("DEFAULT_LATENCY", () => {
    it("should export default latency constant", () => {
      expect(DEFAULT_LATENCY).toBe(0);
    });

    it("should be usable for creating placeholder results", () => {
      const placeholder = createFailure(
        new Error("Not executed"),
        DEFAULT_LATENCY,
      );
      expect(placeholder.latencyMs).toBe(0);
    });
  });
});
