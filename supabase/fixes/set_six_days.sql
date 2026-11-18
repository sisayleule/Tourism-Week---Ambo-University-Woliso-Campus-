-- set_six_days.sql
-- Sets the current edition end_date to 2025-04-12 (Day 6 = Saturday Miyazya 04, 2017 E.C.)
-- Run this if migration 015 has not been applied, or to re-apply the date fix independently.
-- Safe to run multiple times (idempotent).

UPDATE public.editions
SET
  end_date    = '2025-04-12',
  end_date_ec = '04/08/2017'
WHERE is_current = true;
