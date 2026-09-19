-- 070: audit trail for tools the Shopyos AI assistant executes on a user's
-- behalf (search/cart/favorites/store-follow/order-lookup, Phase 1 MVP set).
-- Lets support/admin answer "the assistant did X, why?" after the fact.

CREATE TABLE IF NOT EXISTS ai_tool_executions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID        REFERENCES conversations(id) ON DELETE SET NULL,
    tool_name       TEXT        NOT NULL,
    arguments       JSONB       DEFAULT '{}'::jsonb,
    result_status   TEXT        NOT NULL CHECK (result_status IN ('success', 'error')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_user_id ON ai_tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_conversation_id ON ai_tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_created_at ON ai_tool_executions(created_at);
