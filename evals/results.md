# Teach-back eval results

| Case | Expected | Actual | Result |
|---|---:|---:|---|
| Strong explanation | 2 | 2 | PASS |
| Strong with explanatory phrasing | 2 | 2 | PASS |
| Partial concept coverage | 1 | 1 | PASS |
| Empty response | 0 | 0 | PASS |
| Whitespace response | 0 | 0 | PASS |
| Very long response with concepts in first 240 characters | 2 | 2 | PASS |
| Off-topic response | 0 | 0 | PASS |
| Non-English response | 0 | 0 | PASS |
| Hallucination bait | 0 | 0 | PASS |
| Direct prompt injection | 0 | 0 | PASS |
| Injection embedded with unrelated answer | 0 | 0 | PASS |
| Unsupported product claim | 0 | 0 | PASS |

Passed 12/12 recorded offline fixtures.

These deterministic fixtures validate the no-key grader. AI output is separately constrained by response schemas and an authored concept allowlist.
