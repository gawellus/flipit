import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="text"
        placeholder="Search flashcards..."
        value={localValue}
        onChange={(e) => {
          handleChange(e.target.value);
        }}
        className="pl-[42px]"
      />
    </div>
  );
}
