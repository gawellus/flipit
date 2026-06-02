export interface Flashcard {
  id: string;
  user_id: string;
  generation_id: string | null;
  front: string;
  back: string;
  source: "ai" | "manual";
  created_at: string;
  updated_at: string;
}

export interface FlashcardProposal {
  front: string;
  back: string;
}

export interface CreateFlashcardInput {
  front: string;
  back: string;
  source: "ai" | "manual";
  generation_id?: string;
}
