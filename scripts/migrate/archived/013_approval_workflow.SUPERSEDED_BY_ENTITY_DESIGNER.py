#!/usr/bin/env python3
"""Migration 013: Create Approval Workflow tables.

4 tables:
  approval_rules       - Rule headers (level, approver, amount thresholds, flags)
  approval_conditions  - Condition tree (AND/OR operator nodes + field conditions)
  approval_history     - Per-record routing and audit trail
  approval_roles       - Role mappings for $COST-CENTER:ROLE variable

Approval fields added to header tables (when forms.has_approvals = true) are
handled by schema-generator.ts, not this migration:
  status              citext NOT NULL DEFAULT ''
  submitted_by        citext NOT NULL DEFAULT ''
  submitted_at        timestamptz
  approved_at         timestamptz
  approved_by         citext NOT NULL DEFAULT ''
  is_change_order     boolean NOT NULL DEFAULT false
  submission_attempt  integer NOT NULL DEFAULT 0

Idempotent: safe to re-run.
"""

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

# ── approval_rules ──────────────────────────────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS approval_rules (
  oid               uuid        NOT NULL DEFAULT gen_random_uuid(),
  form_key          citext      NOT NULL DEFAULT '',
  domain            citext      NOT NULL DEFAULT '*',
  rule_name         citext      NOT NULL DEFAULT '',
  level             numeric     NOT NULL DEFAULT 100,
  approver          citext      NOT NULL DEFAULT '',
  amount_field      citext      NOT NULL DEFAULT '',
  accumulation      citext      NOT NULL DEFAULT 'SUM_ALL',
  min_amount        numeric,
  max_amount        numeric,
  instructions      text        NOT NULL DEFAULT '',
  custom_procedure  citext      NOT NULL DEFAULT '',
  eval_per_line     boolean     NOT NULL DEFAULT false,
  is_active         boolean     NOT NULL DEFAULT true,
  stop_on_match     boolean     NOT NULL DEFAULT false,
  is_notify_only    boolean     NOT NULL DEFAULT false,
  is_validation     boolean     NOT NULL DEFAULT false,

  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        text        NOT NULL DEFAULT '',
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text        NOT NULL DEFAULT '',

  PRIMARY KEY (oid),
  UNIQUE (form_key, domain, rule_name),
  CONSTRAINT chk_accumulation CHECK (accumulation IN ('SUM_ALL', 'PER_LINE')),
  CONSTRAINT chk_not_both_flags CHECK (NOT (is_notify_only AND is_validation))
);
""")
print("✓ approval_rules table created")

cur.execute("COMMENT ON TABLE approval_rules IS 'Approval workflow rule headers';")
cur.execute("COMMENT ON COLUMN approval_rules.form_key IS 'Form';")
cur.execute("COMMENT ON COLUMN approval_rules.domain IS 'Domain (* = all domains)';")
cur.execute("COMMENT ON COLUMN approval_rules.rule_name IS 'Rule Name';")
cur.execute("COMMENT ON COLUMN approval_rules.level IS 'Approval Level (decimal, e.g. 10, 10.01, 100)';")
cur.execute("COMMENT ON COLUMN approval_rules.approver IS 'Approver (user ID, group ID, or dynamic variable e.g. $SUPERVISORS)';")
cur.execute("COMMENT ON COLUMN approval_rules.amount_field IS 'Field reference to compare against min/max amount (e.g. Header.total_cost)';")
cur.execute("COMMENT ON COLUMN approval_rules.accumulation IS 'SUM_ALL = sum across all child rows; PER_LINE = evaluate each row individually';")
cur.execute("COMMENT ON COLUMN approval_rules.min_amount IS 'Minimum amount threshold (inclusive)';")
cur.execute("COMMENT ON COLUMN approval_rules.max_amount IS 'Maximum amount threshold (inclusive, null = no upper limit)';")
cur.execute("COMMENT ON COLUMN approval_rules.instructions IS 'Instructions shown to approver on screen and in email';")
cur.execute("COMMENT ON COLUMN approval_rules.custom_procedure IS 'Name of custom procedure to execute after this rule step is approved';")
cur.execute("COMMENT ON COLUMN approval_rules.eval_per_line IS 'If true, generates one approval step per matching child row';")
cur.execute("COMMENT ON COLUMN approval_rules.is_active IS 'Active';")
cur.execute("COMMENT ON COLUMN approval_rules.stop_on_match IS 'Stop evaluating further rules if this rule fires';")
cur.execute("COMMENT ON COLUMN approval_rules.is_notify_only IS 'Notify Only — deferred until final approval, no approval step created';")
cur.execute("COMMENT ON COLUMN approval_rules.is_validation IS 'Validation Rule — blocks submission if conditions match; approver field is the error message';")

cur.execute("""
  CREATE OR REPLACE FUNCTION approval_rules_set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_approval_rules_updated_at ON approval_rules;
  CREATE TRIGGER trg_approval_rules_updated_at
    BEFORE UPDATE ON approval_rules
    FOR EACH ROW EXECUTE FUNCTION approval_rules_set_updated_at();
""")
print("✓ approval_rules trigger created")


# ── approval_conditions ─────────────────────────────────────────────────────
#
# Stores a hierarchical AND/OR condition tree for each rule.
#
# Two node types:
#   Operator node  — group_num > 0, operand is AND or OR, left_side/right_side blank
#   Field condition — group_num = 0, operand is a comparison operator, left_side/right_side populated
#
# parent_group = 0 means "child of the root operator node"
# Walk tree: start at parent_group=0, recurse through group_num references
#
cur.execute("""
CREATE TABLE IF NOT EXISTS approval_conditions (
  oid           uuid        NOT NULL DEFAULT gen_random_uuid(),
  oid_rule      uuid        NOT NULL,
  seq           integer     NOT NULL DEFAULT 0,
  parent_group  integer     NOT NULL DEFAULT 0,
  group_num     integer     NOT NULL DEFAULT 0,
  operand       citext      NOT NULL DEFAULT '',
  left_side     citext      NOT NULL DEFAULT '',
  right_side    citext      NOT NULL DEFAULT '',

  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text        NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text        NOT NULL DEFAULT '',

  PRIMARY KEY (oid),
  FOREIGN KEY (oid_rule) REFERENCES approval_rules(oid) ON DELETE CASCADE
);
""")
print("✓ approval_conditions table created")

cur.execute("COMMENT ON TABLE approval_conditions IS 'Condition tree for approval rules (AND/OR nodes + field comparisons)';")
cur.execute("COMMENT ON COLUMN approval_conditions.oid_rule IS 'Parent approval rule';")
cur.execute("COMMENT ON COLUMN approval_conditions.seq IS 'Display/evaluation order within the rule';")
cur.execute("COMMENT ON COLUMN approval_conditions.parent_group IS 'group_num of parent operator node (0 = child of root)';")
cur.execute("COMMENT ON COLUMN approval_conditions.group_num IS '0 = field condition; >0 = AND/OR operator node';")
cur.execute("COMMENT ON COLUMN approval_conditions.operand IS 'AND/OR for operator nodes; eq/ne/gt/ge/lt/le/in_list/not_in_list/is_blank/is_not_blank/can_do/not_can_do for field conditions';")
cur.execute("COMMENT ON COLUMN approval_conditions.left_side IS 'Field reference or expression (e.g. Header.cost, sum(Lines.amount), hour(now()))';")
cur.execute("COMMENT ON COLUMN approval_conditions.right_side IS 'Value, field reference, dynamic variable, or expression';")

cur.execute("""
  CREATE OR REPLACE FUNCTION approval_conditions_set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_approval_conditions_updated_at ON approval_conditions;
  CREATE TRIGGER trg_approval_conditions_updated_at
    BEFORE UPDATE ON approval_conditions
    FOR EACH ROW EXECUTE FUNCTION approval_conditions_set_updated_at();
""")
print("✓ approval_conditions trigger created")

cur.execute("CREATE INDEX IF NOT EXISTS idx_approval_conditions_rule ON approval_conditions(oid_rule);")
print("✓ approval_conditions index created")


# ── approval_history ─────────────────────────────────────────────────────────
#
# One row per approval step per submission attempt.
# Groups are stored as the group ID — membership is resolved live at query time.
# No decom_approver column needed since PostgreSQL can do real-time group joins.
#
cur.execute("""
CREATE TABLE IF NOT EXISTS approval_history (
  oid                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  form_key            citext      NOT NULL DEFAULT '',
  record_oid          uuid        NOT NULL,
  submission_attempt  integer     NOT NULL DEFAULT 1,
  activated_at        timestamptz,
  level               numeric     NOT NULL DEFAULT 0,
  approver            citext      NOT NULL DEFAULT '',
  approved_by         citext      NOT NULL DEFAULT '',
  status              citext      NOT NULL DEFAULT 'PENDING',
  notes               text        NOT NULL DEFAULT '',
  last_notified_at    timestamptz,
  oid_rule            uuid,

  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          text        NOT NULL DEFAULT '',
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text        NOT NULL DEFAULT '',

  PRIMARY KEY (oid),
  CONSTRAINT chk_status CHECK (status IN ('PENDING','APPROVED','REJECTED','REMOVED','REROUTED','FORCE_APPROVED')),
  FOREIGN KEY (oid_rule) REFERENCES approval_rules(oid) ON DELETE SET NULL
);
""")
print("✓ approval_history table created")

cur.execute("COMMENT ON TABLE approval_history IS 'Per-record approval routing and audit trail';")
cur.execute("COMMENT ON COLUMN approval_history.form_key IS 'Form this record belongs to';")
cur.execute("COMMENT ON COLUMN approval_history.record_oid IS 'OID of the header record being approved';")
cur.execute("COMMENT ON COLUMN approval_history.submission_attempt IS 'Submission attempt number — increments on each resubmit';")
cur.execute("COMMENT ON COLUMN approval_history.activated_at IS 'When this approval step became active (prior levels completed)';")
cur.execute("COMMENT ON COLUMN approval_history.level IS 'Approval sequence level from the rule';")
cur.execute("COMMENT ON COLUMN approval_history.approver IS 'Rule-assigned approver — user ID or group ID';")
cur.execute("COMMENT ON COLUMN approval_history.approved_by IS 'Who actually acted — may be a group member or delegate';")
cur.execute("COMMENT ON COLUMN approval_history.status IS 'PENDING / APPROVED / REJECTED / REMOVED / REROUTED / FORCE_APPROVED';")
cur.execute("COMMENT ON COLUMN approval_history.notes IS 'Required for Reject and Send Back actions';")
cur.execute("COMMENT ON COLUMN approval_history.last_notified_at IS 'When last email notification was sent to this approver';")
cur.execute("COMMENT ON COLUMN approval_history.oid_rule IS 'Rule that generated this step (null for force approvals)';")

cur.execute("""
  CREATE OR REPLACE FUNCTION approval_history_set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_approval_history_updated_at ON approval_history;
  CREATE TRIGGER trg_approval_history_updated_at
    BEFORE UPDATE ON approval_history
    FOR EACH ROW EXECUTE FUNCTION approval_history_set_updated_at();
""")
print("✓ approval_history trigger created")

cur.execute("CREATE INDEX IF NOT EXISTS idx_approval_history_record ON approval_history(form_key, record_oid);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_approval_history_approver ON approval_history(approver, status) WHERE status = 'PENDING';")
print("✓ approval_history indexes created")


# ── approval_roles ───────────────────────────────────────────────────────────
#
# Maps a role name to a user for a given dimension value.
# Used to resolve $COST-CENTER:Director, $ACCOUNT:Manager, etc.
# Roles list is defined in system settings (ROLES setting).
#
cur.execute("""
CREATE TABLE IF NOT EXISTS approval_roles (
  oid              uuid        NOT NULL DEFAULT gen_random_uuid(),
  domain           citext      NOT NULL DEFAULT '*',
  role_name        citext      NOT NULL DEFAULT '',
  dimension_type   citext      NOT NULL DEFAULT '',
  dimension_value  citext      NOT NULL DEFAULT '',
  user_id          citext      NOT NULL DEFAULT '',
  is_active        boolean     NOT NULL DEFAULT true,

  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       text        NOT NULL DEFAULT '',
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text        NOT NULL DEFAULT '',

  PRIMARY KEY (oid),
  UNIQUE (domain, role_name, dimension_type, dimension_value),
  CONSTRAINT chk_dimension_type CHECK (dimension_type IN ('COST_CENTER','ACCOUNT','PROJECT','SITE','SUB_ACCOUNT'))
);
""")
print("✓ approval_roles table created")

cur.execute("COMMENT ON TABLE approval_roles IS 'Role-to-user mappings for $COST-CENTER:ROLE and similar dynamic approver variables';")
cur.execute("COMMENT ON COLUMN approval_roles.domain IS 'Domain (* = all domains)';")
cur.execute("COMMENT ON COLUMN approval_roles.role_name IS 'Role name as defined in ROLES system setting (e.g. Director, Manager)';")
cur.execute("COMMENT ON COLUMN approval_roles.dimension_type IS 'COST_CENTER / ACCOUNT / PROJECT / SITE / SUB_ACCOUNT';")
cur.execute("COMMENT ON COLUMN approval_roles.dimension_value IS 'The specific value (e.g. 8100 for cost center 8100)';")
cur.execute("COMMENT ON COLUMN approval_roles.user_id IS 'User who holds this role for this dimension value';")
cur.execute("COMMENT ON COLUMN approval_roles.is_active IS 'Active';")

cur.execute("""
  CREATE OR REPLACE FUNCTION approval_roles_set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_approval_roles_updated_at ON approval_roles;
  CREATE TRIGGER trg_approval_roles_updated_at
    BEFORE UPDATE ON approval_roles
    FOR EACH ROW EXECUTE FUNCTION approval_roles_set_updated_at();
""")
print("✓ approval_roles trigger created")

cur.execute("CREATE INDEX IF NOT EXISTS idx_approval_roles_lookup ON approval_roles(domain, role_name, dimension_type, dimension_value) WHERE is_active = true;")
print("✓ approval_roles index created")


cur.close()
conn.close()
print("\n✓ Migration 013 complete — approval_rules, approval_conditions, approval_history, approval_roles")
