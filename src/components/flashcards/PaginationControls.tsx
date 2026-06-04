import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => {
          onPageChange(page - 1);
        }}
      >
        Previous
      </Button>
      <span className="text-sm text-white/60">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => {
          onPageChange(page + 1);
        }}
      >
        Next
      </Button>
    </div>
  );
}
