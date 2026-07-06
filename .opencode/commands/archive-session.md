---
name: archive-session
description: Archive the current session state (replaces SessionEnd hook which has no OpenCode equivalent)
---

# Archive Session

Save session state to `.opencode/memory/sessions/`.

1. Write a session snapshot with recent commits and working tree status
2. Copy to `last.md`
3. Keep only the 3 most recent session files
