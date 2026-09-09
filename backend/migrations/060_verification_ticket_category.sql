-- Migration 060: Support-ticket category for the verification recovery path.
-- An applicant who can't complete a step (lost phone, damaged ID, repeated
-- liveness failure past the attempt cap) gets a visible "I can't complete
-- this" action that opens a ticket in the existing support-ticket system
-- rather than a separate recovery mechanism (see plan §Recovery path).
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'verification_issue';
