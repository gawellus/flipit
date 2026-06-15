import { useState } from "react";
import type { FlashcardProposal } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  proposal: FlashcardProposal;
  status: "pending" | "accepted" | "rejected" | "editing";
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
  onSaveEdit: (front: string, back: string) => void;
  onCancelEdit: () => void;
  onUndo: () => void;
}

export function FlashcardItem({
  proposal,
  status,
  onAccept,
  onReject,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onUndo,
}: Props) {
  const [editFront, setEditFront] = useState(proposal.front);
  const [editBack, setEditBack] = useState(proposal.back);

  function handleStartEdit() {
    setEditFront(proposal.front);
    setEditBack(proposal.back);
    onEdit();
  }

  function handleSave() {
    if (editFront.trim() && editBack.trim()) {
      onSaveEdit(editFront.trim(), editBack.trim());
    }
  }

  return (
    <Card
      className={cn(
        "transition-all",
        status === "accepted" && "border-green-500 bg-green-500/4",
        status === "rejected" && "opacity-50",
      )}
    >
      <CardContent>
        {status === "editing" ? (
          <div className="space-y-3">
            <div>
              <label className="text-fi-ink-secondary mb-1 block text-xs">Front</label>
              <Textarea
                value={editFront}
                onChange={(e) => {
                  setEditFront(e.target.value);
                }}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-fi-ink-secondary mb-1 block text-xs">Back</label>
              <Textarea
                value={editBack}
                onChange={(e) => {
                  setEditBack(e.target.value);
                }}
                className="min-h-[60px]"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!editFront.trim() || !editBack.trim()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs">Front</span>
                  <p className={cn("text-fi-ink text-sm", status === "rejected" && "line-through")}>{proposal.front}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Back</span>
                  <p className={cn("text-fi-ink-secondary text-sm", status === "rejected" && "line-through")}>
                    {proposal.back}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {status === "accepted" && <Badge variant="success">Accepted</Badge>}
                {status === "rejected" && <Badge variant="secondary">Rejected</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              {status === "pending" && (
                <>
                  <Button size="sm" variant="outline" onClick={onAccept}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleStartEdit}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onReject}>
                    Reject
                  </Button>
                </>
              )}
              {(status === "accepted" || status === "rejected") && (
                <Button size="sm" variant="ghost" onClick={onUndo}>
                  Undo
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
