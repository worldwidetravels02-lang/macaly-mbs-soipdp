-- The original catalogue seed created three groups of sample Junior Trial cards.
-- Keep the first 20 sample cards as the single published trial progression.
-- Retain the unused placeholder rows as drafts (do not delete any records).
update public.properties
set status = 'draft',
    updated_at = now()
where project_level = 'Junior Trial'
  and slug ~ '^junior-trial-set-[23]-sample-[0-9]{2}$'
  and name ~ '^Sample Project [0-9]{2}$'
  and description like 'Sample placeholder project.%'
  and status = 'published';
