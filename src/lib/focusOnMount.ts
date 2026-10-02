/**
 * Puts the keyboard focus in a field when it appears (`<input ref={focusOnMount} />`), for fields
 * that appear because the user just opened them: the command palette, an inline edit, naming a
 * saved view. Same effect as the autoFocus prop, which the accessibility lint rule reserves for
 * page loads. Defined once at module level, so React calls it only when the field mounts.
 */
export function focusOnMount(el: HTMLElement | null): void {
  el?.focus();
}
