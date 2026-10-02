import React, { useId } from 'react';

/**
 * A label linked to the control right after it (E-02, E-03, E-07): same markup and styles as a
 * plain <label> + <input>, plus a unique id per instance so screen readers and clicks on the
 * label reach the control. The control keeps its own id if it has one.
 */
export function Labelled({ label, labelClassName, children }: { label: React.ReactNode; labelClassName?: string; children: React.ReactElement }) {
  const generated = useId();
  const control = React.Children.only(children) as React.ReactElement<{ id?: string }>;
  const id = control.props.id || generated;
  return (
    <>
      <label htmlFor={id} className={labelClassName}>{label}</label>
      {control.props.id ? control : React.cloneElement(control, { id })}
    </>
  );
}
