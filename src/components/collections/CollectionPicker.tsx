import type { Collection } from "@/types";

interface CollectionPickerProps {
  collections: Collection[];
  value: string | null;
  onChange: (collectionId: string | null) => void;
}

export function CollectionPicker({ collections, value, onChange }: CollectionPickerProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        onChange(e.target.value || null);
      }}
      className="border-fi-hairline text-fi-ink-secondary rounded-full border bg-transparent px-3 py-1 text-xs"
    >
      <option value="">No collection</option>
      {collections.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
