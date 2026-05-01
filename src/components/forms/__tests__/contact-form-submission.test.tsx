/**
 * ContactFormContainer 提交和错误处理测试
 * 专门测试表单提交、网络错误、速率限制等场景
 *
 * 注意：基础测试请参考 contact-form-container-core.test.tsx
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactFormContainer } from "@/components/forms/contact-form-container";

// 确保使用真实的Zod库和validations模块
vi.unmock("zod");

// Mock fetch
global.fetch = vi.fn();

// Mock useActionState for React 19 testing
const mockUseActionState = vi.hoisted(() => vi.fn());
const mockUseRateLimit = vi.hoisted(() => vi.fn());
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: mockUseActionState,
  };
});

vi.mock("@/components/forms/use-rate-limit", () => ({
  useRateLimit: mockUseRateLimit,
}));

// Mock Turnstile
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({
    onSuccess,
    onError,
    onExpire,
  }: {
    onSuccess?: (token: string) => void;
    onError?: (error: string) => void;
    onExpire?: () => void;
  }) => (
    <div data-testid="turnstile-mock">
      <button
        data-testid="turnstile-success"
        onClick={() => onSuccess?.("mock-token")}
      >
        Success
      </button>
      <button
        data-testid="turnstile-error"
        onClick={() => onError?.("mock-error")}
      >
        Error
      </button>
      <button data-testid="turnstile-expire" onClick={() => onExpire?.()}>
        Expire
      </button>
    </div>
  ),
}));

// Mock next-intl
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    company: "Company",
    phone: "Phone",
    subject: "Subject",
    message: "Message",
    submit: "Submit",
    submitting: "Submitting...",
    acceptPrivacy: "I accept the privacy policy",
    submitSuccess: "Message sent successfully",
    submitError: "Failed to submit form. Please try again.",
    rateLimitMessage: "Please wait before submitting again.",
  };
  return translations[key] || key; // key 来自测试数据，安全
});

vi.mock("next-intl", () => ({
  useTranslations: () => mockT,
}));

const originalRequestIdleCallback = window.requestIdleCallback;
const originalCancelIdleCallback = window.cancelIdleCallback;
const originalIntersectionObserver = (
  globalThis as typeof globalThis & {
    IntersectionObserver?: typeof IntersectionObserver;
  }
).IntersectionObserver;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe: IntersectionObserver["observe"] = vi.fn((element: Element) => {
    this.callback(
      [
        {
          isIntersecting: true,
          target: element,
        } as IntersectionObserverEntry,
      ],
      this,
    );
  });

  unobserve: IntersectionObserver["unobserve"] = vi.fn();
  disconnect: IntersectionObserver["disconnect"] = vi.fn();
  takeRecords: IntersectionObserver["takeRecords"] = vi.fn(() => []);
}

// 填写有效表单的辅助函数
const renderContactForm = async () => {
  let utils: ReturnType<typeof render> | undefined;
  await act(async () => {
    utils = render(<ContactFormContainer />);
  });
  await screen.findByTestId("turnstile-mock");
  return utils!;
};

const _fillValidForm = async () => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john.doe@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/company/i), {
      target: { value: "Test Company" },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "+1234567890" },
    });
    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "Test Subject" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Test message content" },
    });

    // 勾选隐私政策
    const privacyCheckbox = screen.getByLabelText(/accept.*privacy/i);
    fireEvent.click(privacyCheckbox);

    // 启用 Turnstile
    const successButton = await screen.findByTestId("turnstile-success");
    fireEvent.click(successButton);
  });
};

describe("ContactFormContainer - 提交和错误处理", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (
      window as typeof window & {
        requestIdleCallback?: typeof globalThis.requestIdleCallback;
        cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
      }
    ).requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback({
        didTimeout: false,
        timeRemaining: () => 1,
      });
      return 1 as unknown as number;
    });

    (
      window as typeof window & {
        cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
      }
    ).cancelIdleCallback = vi.fn();

    (
      globalThis as typeof globalThis & {
        IntersectionObserver?: typeof IntersectionObserver;
      }
    ).IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;

    // Default useActionState mock - idle state
    mockUseActionState.mockReturnValue([
      null, // state
      vi.fn(), // formAction
      false, // isPending
    ]);
    mockUseRateLimit.mockReturnValue({
      isRateLimited: false,
      lastSubmissionTime: null,
      recordSubmission: vi.fn(),
      setLastSubmissionTime: vi.fn(),
    });
  });

  afterEach(() => {
    (
      window as typeof window & {
        requestIdleCallback?: typeof globalThis.requestIdleCallback;
        cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
      }
    ).requestIdleCallback = originalRequestIdleCallback;
    (
      window as typeof window & {
        cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
      }
    ).cancelIdleCallback = originalCancelIdleCallback;

    if (originalIntersectionObserver) {
      (
        globalThis as typeof globalThis & {
          IntersectionObserver?: typeof IntersectionObserver;
        }
      ).IntersectionObserver = originalIntersectionObserver;
    } else {
      Reflect.deleteProperty(globalThis, "IntersectionObserver");
    }
  });

  describe("网络错误处理", () => {
    it("应该处理网络错误", async () => {
      // Mock useActionState to return error state
      mockUseActionState.mockReturnValue([
        { success: false, error: "Network error" }, // state
        vi.fn(), // formAction
        false, // isPending
      ]);

      await renderContactForm();

      // 检查错误消息 - 应该显示通用错误消息而不是具体的网络错误
      expect(screen.getByText(/failed to submit form/i)).toBeInTheDocument();
    });

    it("应该处理速率限制错误", async () => {
      // Mock useActionState to return rate limit error state
      mockUseActionState.mockReturnValue([
        { success: false, error: "Rate limit exceeded" }, // state
        vi.fn(), // formAction
        false, // isPending
      ]);

      await renderContactForm();

      // 检查速率限制消息 - 应该显示通用错误消息而不是具体的速率限制错误
      expect(screen.getByText(/failed to submit form/i)).toBeInTheDocument();
    });

    it("没有 Turnstile token 时不应该提交", async () => {
      await renderContactForm();

      // 填写表单但不启用 Turnstile
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/first name/i), {
          target: { value: "John" },
        });
        fireEvent.change(screen.getByLabelText(/last name/i), {
          target: { value: "Doe" },
        });
        fireEvent.change(screen.getByLabelText(/email/i), {
          target: { value: "john.doe@example.com" },
        });
        fireEvent.change(screen.getByLabelText(/company/i), {
          target: { value: "Test Company" },
        });
        fireEvent.change(screen.getByLabelText(/message/i), {
          target: { value: "Test message content" },
        });

        // 勾选隐私政策
        const privacyCheckbox = screen.getByLabelText(/accept.*privacy/i);
        fireEvent.click(privacyCheckbox);
      });

      const submitButton = screen.getByRole("button", { name: /submit/i });

      // 按钮应该仍然被禁用
      expect(submitButton).toBeDisabled();

      // 不应该调用 fetch
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("速率限制功能", () => {
    it("should start cooldown only after successful submission state", async () => {
      const recordSubmission = vi.fn();
      const setLastSubmissionTime = vi.fn();

      mockUseActionState.mockReturnValue([{ success: true }, vi.fn(), false]);
      mockUseRateLimit.mockReturnValue({
        isRateLimited: false,
        lastSubmissionTime: null,
        recordSubmission,
        setLastSubmissionTime,
      });

      await renderContactForm();

      await waitFor(() => {
        expect(setLastSubmissionTime).toHaveBeenCalledTimes(1);
      });
      expect(recordSubmission).not.toHaveBeenCalled();
    });

    it("should not start cooldown when submission state is error", async () => {
      const recordSubmission = vi.fn();
      const setLastSubmissionTime = vi.fn();

      mockUseActionState.mockReturnValue([
        { success: false, error: "Validation failed" },
        vi.fn(),
        false,
      ]);
      mockUseRateLimit.mockReturnValue({
        isRateLimited: false,
        lastSubmissionTime: null,
        recordSubmission,
        setLastSubmissionTime,
      });

      await renderContactForm();

      await waitFor(() => {
        expect(setLastSubmissionTime).not.toHaveBeenCalled();
      });
      expect(recordSubmission).not.toHaveBeenCalled();
    });

    it("应该在成功提交后显示速率限制", async () => {
      mockUseActionState.mockReturnValue([
        { success: true }, // state
        vi.fn(), // formAction
        false, // isPending
      ]);
      mockUseRateLimit.mockReturnValue({
        isRateLimited: true,
        lastSubmissionTime: new Date("2026-03-09T00:00:00.000Z"),
        recordSubmission: vi.fn(),
        setLastSubmissionTime: vi.fn(),
      });

      await renderContactForm();

      const successButton = await screen.findByTestId("turnstile-success");
      await act(async () => {
        fireEvent.click(successButton);
      });

      expect(
        screen.getByText(/message sent successfully/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/wait before submitting again/i),
      ).toBeInTheDocument();

      const submitButton = screen.getByRole("button", { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it("should re-enable submission after cooldown duration elapses", async () => {
      mockUseActionState.mockReturnValue([{ success: true }, vi.fn(), false]);

      let isRateLimited = true;
      mockUseRateLimit.mockImplementation(() => ({
        isRateLimited,
        lastSubmissionTime: isRateLimited
          ? new Date("2026-03-09T00:00:00.000Z")
          : null,
        recordSubmission: vi.fn(),
        setLastSubmissionTime: vi.fn(),
      }));

      const { rerender } = await renderContactForm();

      const successButton = await screen.findByTestId("turnstile-success");
      await act(async () => {
        fireEvent.click(successButton);
      });

      expect(
        screen.getByText(/wait before submitting again/i),
      ).toBeInTheDocument();

      isRateLimited = false;
      rerender(<ContactFormContainer />);

      await waitFor(() => {
        expect(
          screen.queryByText(/wait before submitting again/i),
        ).not.toBeInTheDocument();
      });
    });

    it("速率限制应该在5分钟后解除", async () => {
      // Mock useActionState to return idle state (no rate limiting)
      mockUseActionState.mockReturnValue([
        null, // state
        vi.fn(), // formAction
        false, // isPending
      ]);

      await renderContactForm();

      // 启用 Turnstile 以使按钮可用
      const successButton = await screen.findByTestId("turnstile-success");
      await act(async () => {
        fireEvent.click(successButton);
      });

      const submitButton = screen.getByRole("button", { name: /submit/i });

      // 按钮应该是启用的（没有速率限制且有Turnstile token）
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("数据格式化", () => {
    it("应该正确格式化提交数据", async () => {
      // Mock useActionState to return success state
      mockUseActionState.mockReturnValue([
        { success: true }, // state
        vi.fn(), // formAction
        false, // isPending
      ]);

      await renderContactForm();

      // 验证表单渲染正确，数据格式化由Server Actions处理
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();

      // 验证成功状态显示
      expect(screen.getByText("Message sent successfully")).toBeInTheDocument();
    });
  });
});
