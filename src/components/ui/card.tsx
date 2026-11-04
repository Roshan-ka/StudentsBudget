import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// The redesign's card (chunk 2): card fill, the 1.5 px outline, an 18 px radius and the offset shadow. `accent` is
// the butter-yellow block (Home's hero, Sunday's check-in). A category's tinted block joins in chunk 4.
const cardVariants = cva(
  "flex flex-col gap-3 rounded-lg border-[1.5px] border-outline p-4 shadow-offset",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        accent: "bg-accent text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** A card as a plain box. A `<section>` with its own heading takes `cardVariants()` as its class instead. */
function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Card, cardVariants }
