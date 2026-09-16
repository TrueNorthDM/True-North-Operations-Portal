-- 084_monday_team_priority.sql
--
-- A priority order for each team's open work on My Work.
--
-- Decided on 16 September 2026: one order per team, set by the team's leader
-- (team_members.position 'team_leader' or 'founder') or by an admin. Everyone on
-- the team sees their own steps in that order, read only. Steps nobody placed
-- follow the default order: the board's priority, then the soonest deadline.
--
-- What is stored is the list as the leader last arranged it, and which of its
-- steps they placed by hand. Only the placed steps keep their place; everything
-- else is re-sorted by the default order every time the page is read, so a
-- deadline that moves in Monday still moves the step. A step is named by its
-- item, its people column and its Monday account ("item|column|account"), the
-- same three things that make a row on My Work.
--
-- Readable by anyone signed in, like the rest of the Monday tables: it says
-- which step comes first, and everyone can already see the steps. There is no
-- write policy on purpose. Writes go through the My Work server action, which
-- checks the real signed-in person against the team (a leader's login is often
-- matched by email rather than by profile_id, which a policy cannot see) and
-- then writes with the service role.
--
-- updated_by only says who last saved it, for the line above the list. It is
-- not taught to merge_people (063): a merge that deletes the saver's duplicate
-- row sets it to NULL, and the order itself is kept.

BEGIN;

CREATE TABLE IF NOT EXISTS monday_team_priority (
  team_id    UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  step_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned     JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE monday_team_priority IS
  'One priority order per team for My Work. Set by the team leader or an admin through the app; read by everyone signed in.';
COMMENT ON COLUMN monday_team_priority.step_order IS
  'Every open step of the team, as the list stood when it was last saved. Step keys are "item_id|people_col|monday_user_id".';
COMMENT ON COLUMN monday_team_priority.pinned IS
  'The keys in step_order that were placed by hand. Only these keep their place; the rest follow the default order.';

ALTER TABLE monday_team_priority ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monday_team_priority_read ON monday_team_priority;
CREATE POLICY monday_team_priority_read ON monday_team_priority
  FOR SELECT TO authenticated USING (true);

COMMIT;
