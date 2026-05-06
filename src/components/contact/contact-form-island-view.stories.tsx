import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ContactFormIslandView } from "@/components/contact/contact-form-island-view";

function LoadedPlaceholder() {
  return (
    <div className="w-[420px] rounded-lg border border-border bg-card p-6 text-sm text-card-foreground">
      Inquiry form island loaded.
    </div>
  );
}

const storyStatusHandler = () => undefined;

const meta = {
  title: "Contact/ContactFormIslandView",
  component: ContactFormIslandView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    errorMessage: "The inquiry form could not load.",
    fallback: (
      <div className="w-[420px] rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading inquiry form...
      </div>
    ),
    retryLabel: "Retry loading",
    loadState: { status: "loading" },
    onRetry: storyStatusHandler,
  },
} satisfies Meta<typeof ContactFormIslandView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoadingFallback: Story = {};

export const Loaded: Story = {
  args: {
    loadState: {
      status: "loaded",
      Component: LoadedPlaceholder,
    },
  },
};

export const LoadFailed: Story = {
  args: {
    loadState: { status: "failed" },
  },
};
