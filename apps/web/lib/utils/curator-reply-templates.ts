export type CuratorTemplateContext = {
  curatorName: string;
  verticals?: string[];
  whatsapp?: string;
};

export type CuratorReplyTemplate = {
  id: string;
  label: string;
  category: "inventory" | "payment" | "delivery" | "support";
  body: string;
};

function hasVertical(context: CuratorTemplateContext, vertical: string) {
  return context.verticals?.some((item) => item.toLowerCase().includes(vertical)) ?? false;
}

export function getCuratorReplyTemplates(
  context: CuratorTemplateContext,
): CuratorReplyTemplate[] {
  const name = context.curatorName;
  const sportswear = hasVertical(context, "football") || hasVertical(context, "sports");

  const shared: CuratorReplyTemplate[] = [
    {
      id: "availability",
      label: "Availability",
      category: "inventory",
      body: `Hi, this is ${name}. This item is currently available. Please send your preferred size and I will confirm stock before payment.`,
    },
    {
      id: "sizing",
      label: "Sizing",
      category: "inventory",
      body: `Please share your usual size and how you like the fit. I will confirm the closest available option before you pay.`,
    },
    {
      id: "payment",
      label: "Payment",
      category: "payment",
      body: `Once I confirm stock, I will send the payment details and amount. Please share the transaction code after payment so I can mark it as paid.`,
    },
    {
      id: "delivery",
      label: "Delivery",
      category: "delivery",
      body: `For delivery, please share your name, phone number, delivery address or pin, and any rider instructions. I will confirm once pickup is arranged.`,
    },
    {
      id: "out-of-stock",
      label: "Out of stock",
      category: "support",
      body: `That exact option is currently out of stock. I can suggest the closest available alternative or notify you when it comes back.`,
    },
  ];

  if (!sportswear) return shared;

  return [
    {
      id: "printing",
      label: "Printing",
      category: "inventory",
      body: `This jersey can be plain or printed. If you want printing, send the name and number exactly as they should appear before I confirm the final price.`,
    },
    ...shared,
    {
      id: "care",
      label: "Jersey care",
      category: "support",
      body: "For printed jerseys, wash inside out with cold water and avoid ironing directly on the print.",
    },
  ];
}
