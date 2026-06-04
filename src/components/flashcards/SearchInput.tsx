import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  onChange: (value: string) => void;
}

export function SearchInput({ onChange }: Props) {
  const [localValue, setLocalValue] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(newValue: string) {
    setLocalValue(newValue);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  }

  return (
    <Input
      type="text"
      placeholder="Search flashcards..."
      value={localValue}
      onChange={(e) => {
        handleChange(e.target.value);
      }}
      className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
    />
  );
}
