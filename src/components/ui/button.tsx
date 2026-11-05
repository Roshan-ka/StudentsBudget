import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// The redesign (chunk 2): a 1.5 px outline, a minimum height of 44 px and no fixed one, so a long German or French
// label wraps instead of being cut. The main button has the offset shadow and sinks into it when pressed (nothing
// moves under reduced motion). `chip` is the outlined pill of a filter or a quick pick; pressed, it fills.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border-[1.5px] border-transparent bg-clip-padding text-center text-sm font-semibold text-balance transition-[background-color,box-shadow,translate] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-outline bg-primary text-primary-foreground shadow-offset hover:bg-primary/90 active:shadow-offset-pressed motion-safe:active:translate-x-0.5 motion-safe:active:translate-y-0.5",
        outline:
          "border-outline bg-card text-foreground hover:bg-muted aria-expanded:bg-muted dark:hover:bg-input/50",
        secondary:
          "border-outline bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        chip:
          "rounded-full border-outline bg-card text-foreground hover:bg-muted aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "min-h-11 gap-1.5 px-4 py-2 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        /** A step's or a form's main action. */
        lg: "min-h-[50px] gap-2 px-5 py-2.5 text-base has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
