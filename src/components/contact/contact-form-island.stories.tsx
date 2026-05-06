import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ContactFormIslandView } from "@/components/contact/contact-form-island-view";
import {
  ContactFormContainerView,
  type ContactFormContainerViewProps,
} from "@/components/forms/contact-form-container-view";
import {
  contactFormApiStoryTranslate,
  contactFormStoryTranslate,
} from "@/components/forms/contact-form-story-fixtures";

const storyFormAction = () => undefined;
const storyTokenHandler = () => undefined;
const storyStatusHandler = () => undefined;

const loadedFormArgs = {
  state: null,
  formAction: storyFormAction,
  isPending: false,
  submitStatus: "idle",
  turnstileToken: "storybook-token",
  isRateLimited: false,
  translateForm: contactFormStoryTranslate,
  translateApi: contactFormApiStoryTranslate,
  onTurnstileSuccess: storyTokenHandler,
  onTurnstileError: storyStatusHandler,
  onTurnstileExpire: storyStatusHandler,
  onTurnstileLoad: storyStatusHandler,
} satisfies ContactFormContainerViewProps;

function LoadedContactFormStory() {
  return <ContactFormContainerView {...loadedFormArgs} />;
}

const meta = {
  title: "Contact/ContactFormIsland",
  component: ContactFormIslandView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    errorMessage: "The inquiry form could not load.",
    fallback: (
      <div className="w-[520px] rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
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
      Component: LoadedContactFormStory,
    },
  },
};

export const LoadFailed: Story = {
  args: {
    loadState: { status: "failed" },
  },
};
