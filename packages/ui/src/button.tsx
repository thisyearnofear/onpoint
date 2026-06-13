import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "./lib/utils"

const buttonVariants = cva(
  // Base classes: tactile press feedback (scale + transition), 44x44 touch target,
  // and standard focus-visible ring.
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[background-color,transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-wait aria-busy:opacity-80 min-h-[44px] min-w-[44px] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        link: "text-primary underline-offset-4 hover:underline active:opacity-70",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Shows a built-in spinner, disables the button, and sets `aria-busy="true"`.
   * When `asChild` is true, this prop is ignored — the child component is
   * responsible for its own loading UI (e.g. a Link doesn't have built-in
   * spinner slots).
   */
  loading?: boolean
  /**
   * Override the default spinner. Receives `className` for sizing/coloring.
   * Ignored when `asChild` is true.
   */
  loadingIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingIcon,
      children,
      disabled,
      type,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? type : type ?? "button"}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <span
                className="inline-flex shrink-0"
                aria-hidden="true"
                data-testid="button-spinner"
              >
                {loadingIcon ?? <DefaultSpinner />}
              </span>
            )}
            {loading ? (
              <span className="inline-flex items-center gap-2 opacity-80">
                {children}
              </span>
            ) : (
              children
            )}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

/**
 * Default inline spinner — a small circle with a rotating border.
 * Pure CSS, no external icon dependency.
 */
function DefaultSpinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      role="presentation"
    />
  )
}

export { Button, buttonVariants }
