// db/repositories/AiToolExecutionRepository.js
// Audit trail for tools the Shopyos AI assistant executes on a user's behalf.

const BaseRepository = require('./BaseRepository');

class AiToolExecutionRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'ai_tool_executions');
  }
}

module.exports = AiToolExecutionRepository;
