/**
 * Small shared pieces for field-level form validation (QA-B/C BUG-11): validators used to
 * `return` on the first failing check, showing one toast and leaving every other invalid field
 * unmarked — a user had to submit repeatedly to discover each problem one at a time. Forms now
 * collect every error into a `Record<field, message>`, mark each failing input, and show its
 * message directly underneath it.
 */

/** Tailwind classes to append to an input's className when `hasError` is true. */
export function fieldErrorClass(hasError: boolean): string {
  return hasError ? "border-destructive focus-visible:ring-destructive" : "";
}

export function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

/** Focuses and scrolls to the first field named in `errors`, in `order`'s priority. */
export function focusFirstError(errors: Record<string, string>, order: string[]): void {
  const firstKey = order.find((key) => errors[key]);
  if (!firstKey) return;
  const el = document.getElementById(firstKey) || document.querySelector(`[name="${firstKey}"]`);
  if (el instanceof HTMLElement) {
    el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el.focus();
  }
}
