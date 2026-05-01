import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const meta = {
  title: "UI/Accordion",
  component: Accordion,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    type: "single",
    collapsible: true,
  },
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-[420px]">
      <AccordionItem value="overview">
        <AccordionTrigger>What can this starter be used for?</AccordionTrigger>
        <AccordionContent>
          Use it for a company, product, or service website that needs clear
          pages, reusable UI, and a simple inquiry path.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="replace">
        <AccordionTrigger>Which content should be replaced?</AccordionTrigger>
        <AccordionContent>
          Replace the sample brand, offers, proof points, contact details, and
          deployment settings before using it for a real project.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const MultipleOpen: Story = {
  render: () => (
    <Accordion
      type="multiple"
      defaultValue={["content", "launch"]}
      className="w-[460px]"
    >
      <AccordionItem value="content">
        <AccordionTrigger>Content checklist</AccordionTrigger>
        <AccordionContent>
          Confirm page structure, offer categories, proof points, and buyer
          questions before adding final copy.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="launch">
        <AccordionTrigger>Launch checklist</AccordionTrigger>
        <AccordionContent>
          Review forms, analytics, deployment configuration, and accessibility
          states before publishing.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const LongChineseContent: Story = {
  render: () => (
    <Accordion type="single" defaultValue="handoff" className="w-[420px]">
      <AccordionItem value="handoff">
        <AccordionTrigger>这个组件适合放什么内容？</AccordionTrigger>
        <AccordionContent>
          适合放常见问题、替换说明、上线前检查项，以及不需要一开始全部展开的补充说明。
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
