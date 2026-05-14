import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  DataCard,
  DataCardContent,
  DataCardDescription,
  DataCardHeader,
  DataCardTitle,
} from "@/components/ui/data-card";

const meta = {
  title: "UI/DataCard",
  component: DataCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DataCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DefaultSpecSurface: Story = {
  render: () => (
    <DataCard className="w-[420px]">
      <DataCardHeader>
        <DataCardTitle>Technical specifications</DataCardTitle>
        <DataCardDescription>
          A reusable data surface for product facts, trade terms, and buyer
          reference details.
        </DataCardDescription>
      </DataCardHeader>
      <DataCardContent>
        <dl className="divide-y divide-border text-sm">
          <div className="grid grid-cols-[1fr_2fr] gap-4 py-3">
            <dt className="font-medium text-muted-foreground">Material</dt>
            <dd className="text-foreground">Stainless steel 304</dd>
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-4 py-3">
            <dt className="font-medium text-muted-foreground">Lead time</dt>
            <dd className="text-foreground">15-20 business days</dd>
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-4 py-3">
            <dt className="font-medium text-muted-foreground">Packaging</dt>
            <dd className="text-foreground">Export carton</dd>
          </div>
        </dl>
      </DataCardContent>
    </DataCard>
  ),
};
