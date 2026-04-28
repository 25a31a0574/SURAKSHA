# Security Specification: Suraksha

## Data Invariants
1. A User profile can only be created/updated by the owner.
2. An Emergency Case can be created by any authenticated user.
3. Once an Emergency Case is solved, it cannot be changed back to active.
4. Responders can only update cases that are active.
5. Leaderboard entries can only be incremented by the system (or through solved case logic).
6. Medical information is sensitive and should be protected.

## The Dirty Dozen Payloads

1. **Identity Theft (User Profile)**: Attempt to update another user's profile role.
2. **Identity Theft (User Profile)**: Create a profile with `role: 'responder'` when not authorized.
3. **Ghost Field (User Profile)**: Add `isAppAdmin: true` to user profile.
4. **Relational Break (Emergency Case)**: Create a case with a `victimId` that doesn't match the sender.
5. **ID Poisoning**: Create a case with a 2KB garbage string as `victimName`.
6. **ID Poisoning**: Use a document ID that contains forbidden characters to bypass filters.
7. **Resource Exhaustion**: Send a case with a 500KB `aiAdvise` string.
8. **State Hijacking**: Re-activate a `solved` case.
9. **Outcome Forgery**: Set `solvedBy` to someone else's UID without finishing the rescue.
10. **Leaderboard Spoofing**: Manually set `casesSolved` to 9999.
11. **PII Leak**: Anonymously read all user `medicalInfo`.
12. **Query Scraping**: List all emergency cases without being a responder.

## Test Runner (Logic Check)
- `users/{userId}`: `write` if `request.auth.uid == userId`.
- `emergency_cases/{caseId}`: `create` if `isSignedIn() && incoming().victimId == request.auth.uid`.
- `emergency_cases/{caseId}`: `update` if `isSignedIn()`.
- `leaderboard/{entryId}`: `write` only if the update is a valid increment from `solveCase` logic.

