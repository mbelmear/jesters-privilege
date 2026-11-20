// What a gate check refused with, line by line, or [] when it passed.
import { Refusal } from "@/lib/pr-gate/snapshot";

export function refusalLines(check: () => void): string[] {
  try {
    check();
    return [];
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    return error.message.split("\n");
  }
}
