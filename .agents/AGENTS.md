# Graphify Auto-Update Rule
Whenever you write new code, modify existing code, or add new features in this repository, you MUST proactively and automatically rebuild the Graphify architecture graph.

Steps to rebuild:
1. Run `graphify . --code-only` in the workspace root.
2. After it finishes, run `graphify cluster-only .` in the workspace root.

Do this automatically without waiting for the user to ask, and ALWAYS inform the user that the graph has been updated in the background.
