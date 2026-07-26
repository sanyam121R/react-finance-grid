import { useCallback, useRef, useState } from "react";

/**
 * Controlled/uncontrolled state helper. Pass `controlled !== undefined` to
 * drive the value externally; otherwise internal state is used. `onChange`
 * fires in both modes.
 */
export function useControllableState<V>(
  controlled: V | undefined,
  onChange: ((value: V) => void) | undefined,
  defaultValue: V | (() => V)
): [V, (value: V) => void] {
  const [inner, setInner] = useState<V>(defaultValue);
  const isControlled = controlled !== undefined;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const value = isControlled ? (controlled as V) : inner;
  const setValue = useCallback(
    (next: V) => {
      if (!isControlled) setInner(next);
      onChangeRef.current?.(next);
    },
    [isControlled]
  );
  return [value, setValue];
}