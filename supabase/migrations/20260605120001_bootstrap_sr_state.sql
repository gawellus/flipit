-- Populate SR state for all existing flashcards so they appear as "new" cards (state=0, due=now())
-- Idempotent: skips flashcards that already have SR state rows
insert into flashcard_sr_state (flashcard_id, user_id)
select id, user_id from flashcards
where id not in (select flashcard_id from flashcard_sr_state);
