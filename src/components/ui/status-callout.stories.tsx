import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusCallout } from "@/components/ui/status-callout";

const meta = {
  title: "UI/StatusCallout",
  component: StatusCallout,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StatusCallout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Warning: Story = {
  args: {
    children:
      "Confirm the product family and buyer region before submitting this inquiry.",
    title: "Review before sending",
    tone: "warning",
  },
};

export const Success: Story = {
  args: {
    children:
      "The team can now review the request and follow up with the buyer.",
    title: "Inquiry received",
    tone: "success",
  },
};

export const Error: Story = {
  args: {
    children: "Please check the highlighted fields and try again.",
    title: "Submission failed",
    tone: "error",
  },
};
