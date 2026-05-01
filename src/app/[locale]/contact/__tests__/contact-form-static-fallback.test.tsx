import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactFormStaticFallback } from "@/app/[locale]/contact/contact-form-static-fallback";

const messages = {
  contact: {
    form: {
      title: "Contact form",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      company: "Company Name",
      message: "Message",
      acceptPrivacy: "I agree to the privacy policy",
      submit: "Submit",
    },
  },
};

describe("ContactFormStaticFallback", () => {
  it("renders a disabled static form while the streamed Contact form loads", () => {
    render(<ContactFormStaticFallback messages={messages} />);

    const form = document.querySelector(
      '[data-contact-form-fallback="static"]',
    );

    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("First Name")).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("protects fallback labels and submit copy at the leaf level", () => {
    render(<ContactFormStaticFallback messages={messages} />);

    const firstNameLabel = screen.getByText("First Name");
    const submitLabel = screen.getByText("Submit");

    expect(firstNameLabel).toHaveAttribute("translate", "no");
    expect(submitLabel).toHaveAttribute("translate", "no");
  });

  it("fails fast when required fallback copy is missing", () => {
    expect(() =>
      render(
        <ContactFormStaticFallback messages={{ contact: { form: {} } }} />,
      ),
    ).toThrow("Missing required message: contact.form.title");
  });
});
