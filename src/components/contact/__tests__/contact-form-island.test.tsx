import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reportError = vi.fn();

function LoadedContactForm() {
  return <form aria-label="Contact form">Loaded contact form</form>;
}

async function renderIsland() {
  const { ContactFormIsland } =
    await import("@/components/contact/contact-form-island");

  return {
    ...render(
      <ContactFormIsland
        errorMessage="The form could not load."
        fallback={<div>Loading inquiry form</div>}
        retryLabel="Retry loading form"
      />,
    ),
  };
}

function mockContactFormModule() {
  vi.doMock("@/components/contact/contact-form", () => ({
    ContactForm: LoadedContactForm,
  }));
}

function mockContactFormModuleWithRetry() {
  let shouldFail = true;
  const loadAttempts: string[] = [];

  vi.doMock("@/components/contact/contact-form", () => {
    loadAttempts.push("load");

    if (shouldFail) {
      throw new Error("chunk unavailable");
    }

    return { ContactForm: LoadedContactForm };
  });

  return {
    allowRetry: () => {
      shouldFail = false;
    },
    loadAttempts,
  };
}

describe("ContactFormIsland", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal("reportError", reportError);
    reportError.mockClear();
  });

  it("shows the loading fallback until the real form loads", async () => {
    mockContactFormModule();

    await renderIsland();

    expect(screen.getByText("Loading inquiry form")).toBeInTheDocument();
    expect(
      await screen.findByRole("form", { name: "Contact form" }),
    ).toBeInTheDocument();
  });

  it("shows a visible retry state when the form chunk fails to load", async () => {
    const contactFormModule = mockContactFormModuleWithRetry();
    const user = userEvent.setup();

    await renderIsland();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The form could not load.",
    );
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0]?.[0]).toBeInstanceOf(Error);

    contactFormModule.allowRetry();
    await user.click(
      screen.getByRole("button", { name: "Retry loading form" }),
    );

    expect(
      await screen.findByRole("form", { name: "Contact form" }),
    ).toBeInTheDocument();
    expect(contactFormModule.loadAttempts).toHaveLength(2);
  });

  it("does not require browser reportError to render the visible retry state", async () => {
    vi.unstubAllGlobals();
    mockContactFormModuleWithRetry();

    await renderIsland();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The form could not load.",
    );
  });
});
