export interface Flashcard {
  id: string;
  user_id: string;
  generation_id: string | null;
  collection_id: string | null;
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

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionWithCounts extends Collection {
  card_count: number;
  due_count: number;
}

export interface FlashcardSRState {
  flashcard_id: string;
  user_id: string;
  difficulty: number;
  due: string;
  elapsed_days: number;
  lapses: number;
  last_review: string | null;
  learning_steps: number;
  reps: number;
  scheduled_days: number;
  stability: number;
  state: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewLog {
  id: string;
  flashcard_id: string;
  user_id: string;
  rating: number;
  state: number;
  difficulty: number;
  stability: number;
  due: string;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  review: string;
  created_at: string;
}

export interface StudyCard {
  id: string;
  front: string;
  back: string;
  difficulty: number;
  due: string;
  elapsed_days: number;
  lapses: number;
  last_review: string | null;
  learning_steps: number;
  reps: number;
  scheduled_days: number;
  stability: number;
  state: number;
}

export interface IntervalPreview {
  rating: number;
  label: string;
}
