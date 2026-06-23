import type { Collection } from "@/types";
import { Button } from "@/components/ui/button";
import { CollectionPicker } from "@/components/collections/CollectionPicker";
import { Trash2 } from "lucide-react";
import { useState } from "react";

interface Props {
  selectedCount: number;
  collections: Collection[];
  onMove: (collectionId: string | null) => void;
  onDelete: () => void;
  isLoading: boolean;
}

export function BulkActionBar({ selectedCount, collections, onMove, onDelete, isLoading }: Props) {
  const [moveCollectionId, setMoveCollectionId] = useState<string | null>(null);

  return (
    <div className="border-fi-hairline bg-fi-canvas sticky top-0 z-10 flex items-center justify-between rounded-xl border px-4 py-3 shadow-[var(--shadow-card)]">
      <span className="text-muted-foreground text-sm tabular-nums">{selectedCount} selected</span>
      <div className="flex items-center gap-2">
        <CollectionPicker collections={collections} value={moveCollectionId} onChange={setMoveCollectionId} />
        <Button
          size="sm"
          variant="outline"
          disabled={isLoading}
          onClick={() => {
            onMove(moveCollectionId);
          }}
        >
          Move
        </Button>
      </div>
      <Button size="sm" variant="destructive" disabled={isLoading} onClick={onDelete}>
        <Trash2 className="size-3.5" />
        Delete ({selectedCount})
      </Button>
    </div>
  );
}
