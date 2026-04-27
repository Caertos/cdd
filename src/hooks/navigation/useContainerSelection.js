import { useState, useCallback } from 'react';

export function useContainerSelection(total) {
  const [selected, setSelected] = useState(0);

  const handleNavigation = useCallback(
    (input, key) => {
      if (total === 0) {
        return false;
      }

      if (key.upArrow) {
        setSelected((i) => (i === 0 ? total - 1 : i - 1));
        return true;
      }

      if (key.downArrow) {
        setSelected((i) => (i === total - 1 ? 0 : i + 1));
        return true;
      }

      return false;
    },
    [total]
  );

  return { selected, setSelected, handleNavigation };
}
