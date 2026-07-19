import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@repo/ui/button";

describe("Button primitive", () => {
  describe("press feedback (active states)", () => {
    it("includes the active:scale class in the base variants", () => {
      const { container } = render(<Button>Click me</Button>);
      const btn = container.querySelector("button");
      expect(btn?.className).toContain("active:scale-[0.98]");
    });

    it("default variant includes active:bg-primary/80", () => {
      const { container } = render(<Button>Click me</Button>);
      expect(container.querySelector("button")?.className).toContain(
        "active:bg-primary/80",
      );
    });

    it("destructive variant includes active:bg-destructive/80", () => {
      const { container } = render(
        <Button variant="destructive">Delete</Button>,
      );
      expect(container.querySelector("button")?.className).toContain(
        "active:bg-destructive/80",
      );
    });

    it("secondary variant includes active:bg-secondary/70", () => {
      const { container } = render(
        <Button variant="secondary">Cancel</Button>,
      );
      expect(container.querySelector("button")?.className).toContain(
        "active:bg-secondary/70",
      );
    });

    it("ghost variant darkens slightly on active", () => {
      const { container } = render(<Button variant="ghost">Open</Button>);
      expect(container.querySelector("button")?.className).toContain(
        "active:bg-accent/80",
      );
    });

    it("link variant dims on active (no scale, since text-only)", () => {
      const { container } = render(<Button variant="link">Link</Button>);
      const btn = container.querySelector("button");
      expect(btn?.className).toContain("active:opacity-70");
      // The base active:scale is present but acceptable for a text link
      // (Tailwind will still apply it; if undesired, override in className).
    });
  });

  describe("loading prop", () => {
    it("is not present by default", () => {
      const { container } = render(<Button>Save</Button>);
      const btn = container.querySelector("button");
      expect(btn?.getAttribute("aria-busy")).toBeNull();
      expect(btn?.getAttribute("data-loading")).toBeNull();
      expect(btn?.hasAttribute("disabled")).toBe(false);
    });

    it("sets aria-busy and data-loading when loading=true", () => {
      const { container } = render(<Button loading>Save</Button>);
      const btn = container.querySelector("button");
      expect(btn?.getAttribute("aria-busy")).toBe("true");
      expect(btn?.getAttribute("data-loading")).toBe("true");
    });

    it("disables the button when loading=true", () => {
      const { container } = render(<Button loading>Save</Button>);
      const btn = container.querySelector("button");
      expect(btn?.hasAttribute("disabled")).toBe(true);
    });

    it("renders a default spinner when loading=true", () => {
      const { container, getByTestId } = render(<Button loading>Save</Button>);
      expect(getByTestId("button-spinner")).toBeTruthy();
      // Spinner should be aria-hidden
      const spinner = container.querySelector('[data-testid="button-spinner"]');
      expect(spinner?.getAttribute("aria-hidden")).toBe("true");
    });

    it("renders a custom loadingIcon when provided", () => {
      const { getByTestId } = render(
        <Button
          loading
          loadingIcon={<span data-testid="custom-spinner">★</span>}
        >
          Save
        </Button>,
      );
      expect(getByTestId("custom-spinner")).toBeTruthy();
    });

    it("still shows children alongside the spinner (so label is preserved)", () => {
      render(<Button loading>Uploading...</Button>);
      expect(screen.getByText("Uploading...")).toBeTruthy();
    });

    it("does not fire onClick when loading=true", () => {
      const onClick = vi.fn();
      const { container } = render(
        <Button loading onClick={onClick}>
          Save
        </Button>,
      );
      const btn = container.querySelector("button") as HTMLButtonElement;
      btn.click();
      expect(onClick).not.toHaveBeenCalled();
    });

    it("loading=true wins over an explicit disabled=false", () => {
      const { container } = render(
        <Button loading disabled={false}>
          Save
        </Button>,
      );
      const btn = container.querySelector("button");
      expect(btn?.hasAttribute("disabled")).toBe(true);
    });
  });

  describe("disabled prop", () => {
    it("disables the button when disabled=true", () => {
      const { container } = render(<Button disabled>Save</Button>);
      const btn = container.querySelector("button");
      expect(btn?.hasAttribute("disabled")).toBe(true);
      // Disabled buttons should NOT be marked aria-busy
      expect(btn?.getAttribute("aria-busy")).toBeNull();
    });

    it("does not fire onClick when disabled", () => {
      const onClick = vi.fn();
      const { container } = render(
        <Button disabled onClick={onClick}>
          Save
        </Button>,
      );
      const btn = container.querySelector("button") as HTMLButtonElement;
      btn.click();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("asChild", () => {
    it("passes disabled and aria-busy to the child via Slot", () => {
      const { container } = render(
        <Button asChild loading>
          <a href="/somewhere">Link</a>
        </Button>,
      );
      const anchor = container.querySelector("a");
      expect(anchor).toBeTruthy();
      // The Slot forwards the props to the child
      expect(anchor?.getAttribute("aria-busy")).toBe("true");
    });

    it("does NOT inject a spinner when asChild is true (child is responsible)", () => {
      const { queryByTestId } = render(
        <Button asChild loading>
          <a href="/somewhere">Link</a>
        </Button>,
      );
      expect(queryByTestId("button-spinner")).toBeNull();
    });

    it("does not set default type=button when asChild is true (preserves child's type)", () => {
      const { container } = render(
        <Button asChild>
          <a href="/somewhere">Link</a>
        </Button>,
      );
      const anchor = container.querySelector("a");
      // <a> doesn't have a type attribute, so the Button shouldn't add one
      expect(anchor?.hasAttribute("type")).toBe(false);
    });

    it("still applies active:scale to the child", () => {
      const { container } = render(
        <Button asChild>
          <a href="/somewhere">Link</a>
        </Button>,
      );
      const anchor = container.querySelector("a");
      expect(anchor?.className).toContain("active:scale-[0.98]");
    });
  });

  describe("default props", () => {
    it("defaults type to 'button' to prevent form submission", () => {
      const { container } = render(<Button>Click me</Button>);
      const btn = container.querySelector("button");
      expect(btn?.getAttribute("type")).toBe("button");
    });

    it("respects a custom type when provided", () => {
      const { container } = render(<Button type="submit">Submit</Button>);
      const btn = container.querySelector("button");
      expect(btn?.getAttribute("type")).toBe("submit");
    });
  });

  describe("className merging", () => {
    it("merges user-provided className with variant classes", () => {
      const { container } = render(
        <Button className="bg-success hover:bg-success">
          Custom
        </Button>,
      );
      const btn = container.querySelector("button");
      // Both the default variant classes AND the user override should be present
      // (twMerge handles conflicts, so default `bg-primary` is replaced by `bg-success`)
      expect(btn?.className).toContain("bg-success");
      expect(btn?.className).toContain("active:scale-[0.98]");
    });
  });
});
