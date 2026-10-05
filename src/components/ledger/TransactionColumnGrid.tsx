import { Children, cloneElement, isValidElement } from 'react';
import type { CSSProperties, HTMLAttributes, ReactElement } from 'react';

/** Header and rows use the same stable presentation order, including their keyboard/DOM order. */
export function TransactionColumnGrid({ naturalOrder, order, children, ...props }: HTMLAttributes<HTMLDivElement> & { naturalOrder: string[]; order: string[] }) {
  const cells = Children.toArray(children).filter(isValidElement);
  const byId = new Map(naturalOrder.map((id, position) => [id, cells[position]]));
  return <div {...props}>{cells.length === naturalOrder.length ? order.map(id => {
    const child = byId.get(id) as ReactElement<{ style?: CSSProperties; 'data-column'?: string }> | undefined;
    return child ? cloneElement(child, { key: id, 'data-column': id }) : null;
  }) : children}</div>;
}
