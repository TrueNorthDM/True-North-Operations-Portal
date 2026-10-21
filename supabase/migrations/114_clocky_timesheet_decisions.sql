-- 114: Clocky, approving and returning a timesheet (owner's mockup of
-- 20 October 2026: Approvals shows the periods people sent, for Super Admins).
--
-- The history keeps each decision with its reason, as it keeps every other
-- change to hours: two more actions for tc_entry_audit. 'reopen' was already
-- there (migration 112). Nothing else changes: tc_submissions has carried the
-- states draft, submitted, approved and returned since migration 057.
--
-- Safe to run again.

ALTER TABLE tc_entry_audit DROP CONSTRAINT IF EXISTS tc_entry_audit_action_check;
ALTER TABLE tc_entry_audit ADD CONSTRAINT tc_entry_audit_action_check CHECK (action IN (
  -- My Hours, before Clocky: kept for the rows already written.
  'create', 'update', 'delete',
  -- The clock.
  'clock_in', 'switch', 'clock_out', 'undo_clock_out', 'auto_stop', 'confirm_end', 'keep_going',
  -- People changing hours (a reason each), and what follows from a decision.
  'add', 'edit', 'trim', 'grid', 'clocked_out_for', 'correction_approved', 'imported', 'reopen',
  -- A sent timesheet approved, or returned with a reason.
  'approve_period', 'return_period'
));
