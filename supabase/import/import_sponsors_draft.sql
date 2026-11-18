-- =============================================================================
-- import_sponsors_draft.sql
--
-- Run only after the department confirms these names.
--
-- Inserts the sponsor names found in src/data/seedData.ts as DRAFT rows
-- without logos.  Logos are uploaded via the /staff/sponsors or
-- /admin/content/sponsors interface after the department approves.
--
-- Sponsor names from seedData.ts:
--   1. Ethiopian Tourism Board                   (title tier)
--   2. Oromia Tourism Commission                 (title tier)
--   3. Woliso Eco-Lodge & Hot Springs Resort     (gold tier)
--   4. Negash Resort & Botanical Garden          (gold tier)
--   5. Woliso Town Municipality                  (silver tier)
--   6. Commercial Bank of Ethiopia (Woliso Branch) (silver tier)
--   7. South West Shewa Cultural Artisans Association (partner tier)
--   8. Ambo University Alumni Hospitality Network    (partner tier)
-- =============================================================================

INSERT INTO public.sponsors (name, tier, sort_order, state, logo_url, website_url)
VALUES
  ('Ethiopian Tourism Board',                        'title',   10, 'draft', NULL, NULL),
  ('Oromia Tourism Commission',                      'title',   20, 'draft', NULL, NULL),
  ('Woliso Eco-Lodge & Hot Springs Resort',          'gold',    10, 'draft', NULL, NULL),
  ('Negash Resort & Botanical Garden',               'gold',    20, 'draft', NULL, NULL),
  ('Woliso Town Municipality',                       'silver',  10, 'draft', NULL, NULL),
  ('Commercial Bank of Ethiopia (Woliso Branch)',    'silver',  20, 'draft', NULL, NULL),
  ('South West Shewa Cultural Artisans Association', 'partner', 10, 'draft', NULL, NULL),
  ('Ambo University Alumni Hospitality Network',     'partner', 20, 'draft', NULL, NULL)
ON CONFLICT DO NOTHING;
