import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MotionProvider } from "@/components/motion-provider";
import { Toggle } from "@/components/ui/toggle";
import type { styleguide } from "@/content/styleguide";
import { MotionDemo } from "./motion-demo";

type Scheme = "light" | "dark";

// `scheme-*` pins this panel's color-scheme, so every token inside resolves to
// its light or dark value whatever the page's theme. (Menus and dialogs open
// in a portal at the page level, so they follow the page's theme instead.)
const schemeClass: Record<Scheme, string> = {
  light: "scheme-light",
  dark: "scheme-dark",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    // Not a landmark: both panels repeat these titles, and only the panels
    // themselves need to be regions.
    <div className="flex flex-col gap-4">
      <h3
        id={id}
        className="border-b border-border pb-2 font-ui text-sm font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function ComponentRow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-ui text-base font-semibold">{title}</h4>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Every token, typeface, and component, rendered in one theme. */
export function Specimen({
  scheme,
  copy,
}: {
  scheme: Scheme;
  copy: typeof styleguide;
}) {
  const id = (name: string) => `${scheme}-${name}`;
  const { components } = copy;

  return (
    <section
      aria-labelledby={id("panel")}
      className={cn(
        schemeClass[scheme],
        "flex min-w-0 flex-col gap-10 rounded-lg border border-border bg-background p-4 text-foreground sm:p-6"
      )}
    >
      <h2 id={id("panel")} className="font-display text-3xl">
        {copy.panels[scheme]}
      </h2>

      <Section id={id("colors")} title={copy.sections.colors}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {copy.colors.map(({ token, role }) => (
            <li key={token} className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-12 shrink-0 rounded-md border border-border shadow-sm"
                style={{ background: `var(--${token})` }}
              />
              <div className="min-w-0">
                <code className="font-ui text-sm font-semibold">{token}</code>
                <p className="text-sm text-muted-foreground">{role}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id={id("type")} title={copy.sections.type}>
        {copy.typefaces.map(({ name, role, utility, sample }) => (
          <div key={name} className="flex flex-col gap-1">
            <h4 className="font-ui text-base font-semibold">{name}</h4>
            <p className="font-ui text-sm text-muted-foreground">
              {role} · <code>{utility}</code>
            </p>
            <p className={cn(utility, "text-xl")}>{sample}</p>
          </div>
        ))}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="font-display text-5xl leading-tight">
            {copy.typeScale.display}
          </p>
          <p className="font-display text-3xl">{copy.typeScale.heading}</p>
          <p className="font-display text-4xl text-brand-display">
            {copy.typeScale.orangeDisplay}
          </p>
          <p>
            <span className="rounded-sm border border-brand-ink px-2 py-0.5 font-ui text-xs font-semibold tracking-wider text-brand-ink uppercase">
              {copy.typeScale.smallOrange}
            </span>
          </p>
          <p className="text-lg">
            <a
              href={`#${id("type")}`}
              className="text-primary underline underline-offset-3"
            >
              {copy.typeScale.link}
            </a>
          </p>
          <p className="text-lg italic">{copy.typeScale.italic}</p>
          <p className="font-ui text-sm text-muted-foreground">
            {copy.typeScale.meta}
          </p>
        </div>
      </Section>

      <Section id={id("shape")} title={copy.sections.shape}>
        <ul className="flex flex-wrap gap-4">
          {copy.radii.map((radius) => (
            <li key={radius} className="flex flex-col items-center gap-2">
              <span
                aria-hidden
                className="size-14 border-2 border-primary bg-muted"
                style={{ borderRadius: `var(--radius-${radius})` }}
              />
              <code className="font-ui text-sm">rounded-{radius}</code>
            </li>
          ))}
          {copy.shadows.map((shadow) => (
            <li key={shadow} className="flex flex-col items-center gap-2">
              <span
                aria-hidden
                className="size-14 rounded-md bg-card"
                style={{ boxShadow: `var(--shadow-${shadow})` }}
              />
              <code className="font-ui text-sm">shadow-{shadow}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id={id("motion")} title={copy.sections.motion}>
        <MotionProvider>
          {copy.motion.map(({ name, role }) => (
            <div key={name} className="flex flex-col gap-2">
              <p>
                <code className="font-ui font-semibold">{name}</code>
                <span className="text-muted-foreground"> · {role}</span>
              </p>
              <MotionDemo preset={name} replayLabel={copy.motionReplay} />
            </div>
          ))}
        </MotionProvider>
        <p className="text-sm text-muted-foreground">
          {copy.motionReducedNote}
        </p>
      </Section>

      <Section id={id("components")} title={copy.sections.components}>
        <ComponentRow title={components.buttons.heading}>
          {components.buttons.variants.map(({ variant, label }) => (
            <Button key={variant} variant={variant}>
              {label}
            </Button>
          ))}
          <Button disabled>{components.buttons.disabled}</Button>
        </ComponentRow>

        <ComponentRow title={components.toggle.heading}>
          <Toggle variant="outline" defaultPressed={false}>
            {components.toggle.off}
          </Toggle>
          <Toggle variant="outline" defaultPressed>
            {components.toggle.on}
          </Toggle>
        </ComponentRow>

        <ComponentRow title={components.checkbox.heading}>
          <div className="flex items-center gap-3">
            <Checkbox id={id("consent")} />
            <label htmlFor={id("consent")}>{components.checkbox.label}</label>
          </div>
        </ComponentRow>

        <ComponentRow title={components.select.heading}>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <label htmlFor={id("type-select")} className="font-ui font-medium">
              {components.select.label}
            </label>
            <Select defaultValue={components.select.options[0].value}>
              <SelectTrigger id={id("type-select")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {components.select.options.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ComponentRow>

        <ComponentRow title={components.dialog.heading}>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">{components.dialog.open}</Button>
            </DialogTrigger>
            <DialogContent closeLabel={components.dialog.close}>
              <DialogHeader>
                <DialogTitle>{components.dialog.title}</DialogTitle>
                <DialogDescription>
                  {components.dialog.description}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">{components.dialog.cancel}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>{components.dialog.confirm}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ComponentRow>

        <ComponentRow title={components.menu.heading}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{components.menu.open}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{components.menu.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {components.menu.items.map((item) => (
                <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </ComponentRow>
      </Section>
    </section>
  );
}
