import { useState, useEffect } from "react";

export function useHideValues() {
  const [hideValues, setHideValues] = useState(() => {
    const saved = localStorage.getItem("hide-financial-values");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("hide-financial-values", hideValues.toString());
  }, [hideValues]);

  const toggleHideValues = () => setHideValues(prev => !prev);

  const formatValue = (value: number, formatter: (v: number) => string) => {
    if (hideValues) return "••••••";
    return formatter(value);
  };

  return { hideValues, toggleHideValues, formatValue };
}
