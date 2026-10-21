/** Match one inline editor by field/context while retaining its current visible value in the name. */
export function inlineEditName(actionLabel: string): RegExp {
  return new RegExp('^' + actionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ': ');
}
