import type { styleguide } from "@/content/styleguide";
import styles from "./module-specimen.module.css";

/** A specimen styled only by its CSS module, to show modules build (#92). */
export function ModuleSpecimen({
  copy,
}: {
  copy: (typeof styleguide)["cssModule"];
}) {
  return (
    <section
      aria-labelledby="css-module"
      className="flex max-w-2xl flex-col gap-3"
    >
      <h2 id="css-module" className="font-display text-3xl">
        {copy.heading}
      </h2>
      <p className="text-muted-foreground">{copy.note}</p>
      <p className={styles.proclamation}>{copy.proclamation}</p>
    </section>
  );
}
