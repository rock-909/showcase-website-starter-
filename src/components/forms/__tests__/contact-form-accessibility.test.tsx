import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactFormContainer } from "@/components/forms/contact-form-container";

const mockUseActionState = vi.hoisted(() => vi.fn());
const mockUseRateLimit = vi.hoisted(() => vi.fn());

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: mockUseActionState,
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      company: "Company",
      subject: "Subject",
      message: "Message",
      acceptPrivacy: "I accept the privacy policy",
      marketingConsent: "I agree to receive marketing communications",
      submit: "Submit",
      submitting: "Submitting...",
      submitError: "Failed to submit form. Please try again.",
      firstNamePlaceholder: "Enter your first name",
      lastNamePlaceholder: "Enter your last name",
      emailPlaceholder: "Enter your email",
      companyPlaceholder: "Enter your company",
      subjectPlaceholder: "Enter your subject",
      messagePlaceholder: "Enter your message",
      error: "There was a problem",
      CONTACT_SUBMISSION_EXPIRED:
        "This form expired. Please refresh the page and try again.",
    };

    return translations[key] ?? key;
  },
}));

vi.mock("@/components/forms/use-rate-limit", () => ({
  useRateLimit: mockUseRateLimit,
}));

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ onSuccess }: { onSuccess?: (_token: string) => void }) => (
    <button
      type="button"
      data-testid="turnstile-success"
      onClick={() => onSuccess?.("mock-token")}
    >
      Turnstile Success
    </button>
  ),
}));

describe("ContactFormContainer accessibility", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    mockUseRateLimit.mockReturnValue({
      isRateLimited: false,
      lastSubmissionTime: null,
      recordSubmission: vi.fn(),
      setLastSubmissionTime: vi.fn(),
    });

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
      globalThis as typeof globalThis & {
        IntersectionObserver?: typeof IntersectionObserver;
      }
    ).IntersectionObserver = class {
      observe = vi.fn((element: Element) => {
        this.callback(
          [
            {
              isIntersecting: true,
              target: element,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver,
        );
      });
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);

      constructor(private readonly callback: IntersectionObserverCallback) {}
    } as unknown as typeof IntersectionObserver;
  });

  it("adds useful autocomplete and input hints to contact fields", async () => {
    render(<ContactFormContainer />);

    await screen.findByTestId("turnstile-success");

    expect(screen.getByLabelText(/first name/i)).toHaveAttribute(
      "autocomplete",
      "given-name",
    );
    expect(screen.getByLabelText(/last name/i)).toHaveAttribute(
      "autocomplete",
      "family-name",
    );
    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      "inputmode",
      "email",
    );
    expect(screen.getByLabelText(/company/i)).toHaveAttribute(
      "autocomplete",
      "organization",
    );
    expect(screen.getByLabelText(/subject/i)).toHaveAttribute(
      "autocomplete",
      "off",
    );
    expect(screen.getByLabelText(/message/i)).toHaveAttribute(
      "autocomplete",
      "off",
    );
  });

  it("focuses the error summary when the server returns a submission error", async () => {
    mockUseActionState.mockReturnValue([
      {
        success: false,
        errorCode: "CONTACT_SUBMISSION_EXPIRED",
      },
      vi.fn(),
      false,
    ]);

    await act(async () => {
      render(<ContactFormContainer />);
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveFocus();
  });
});
