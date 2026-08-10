# REST API

All timestamps are ISO-8601 UTC in MongoDB. Error responses use `{ "error": { "code", "message", "details?" } }`. All candidate resources enforce JWT candidate scope server-side; all administrator endpoints require an administrator JWT.

## Authentication and invitations

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/admin/login` | None | Returns 8-hour administrator JWT. Rate limited. |
| POST | `/api/invitations/verify` | None | Verifies code, returns short-lived `interviewToken` and status-only token. Rate limited. |
| GET | `/api/candidates/status` | Candidate status token | Safe candidate status only. |

`POST /api/invitations/verify`

```json
{ "code": "APAI-7F29-KQ81" }
```

## Candidate and interview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/candidates/:candidateId/resume` | Multipart field `resume`; upload and parse candidate's own resume. |
| GET | `/api/candidates/resumes/:resumeId/download` | Candidate's own private resume. |
| POST | `/api/interviews/start` | Save consent and start/recover the current attempt. |
| GET | `/api/interviews/:interviewId/current` | Returns only the current question, never a future list. |
| POST | `/api/interviews/:interviewId/answers` | Submit current answer. Requires `Idempotency-Key`. |
| POST | `/api/interviews/:interviewId/events` | Store an authorized client integrity event. |
| POST | `/api/interviews/:interviewId/complete` | Complete using stored answers. |
| POST | `/api/interviews/:interviewId/recording/chunks` | Multipart field `chunk` and integer `index`. |
| POST | `/api/interviews/:interviewId/recording/finalize` | Join sequential chunks privately. |

`POST /api/interviews/start`

```json
{
  "consent": {
    "version": "2026-08",
    "recording": true,
    "camera": true,
    "microphone": true,
    "monitoring": true
  }
}
```

`POST /api/interviews/:id/answers`

```json
{
  "questionId": "64b7d8e7196f1485df1a55ab",
  "transcript": "I used React Native to build...",
  "transcriptConfidence": 0.86,
  "source": "SPEECH"
}
```

## Administrator

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET / PUT | `/api/admin/settings` | Get/update settings for new interviews. Weight total must equal 100. |
| GET | `/api/admin/dashboard` | Counts and recent completed interviews. |
| POST | `/api/admin/candidates` | Create candidate + invitation. |
| GET | `/api/admin/candidates?q=&status=&position=` | Search/list candidates. |
| GET | `/api/admin/candidates/:candidateId` | Resume, assessment, Q&A evidence, events, decision and recording metadata. |
| POST | `/api/admin/candidates/:candidateId/invitation/reset` | Revokes old access, increments session version and creates a new code. |
| POST | `/api/admin/interviews/:interviewId/terminate` | Terminate an active attempt with a reason. |
| POST | `/api/admin/interviews/:interviewId/decision` | `ACCEPT`, `REJECT`, `HOLD` or `REINTERVIEW`. |
| GET / DELETE | `/api/admin/interviews/:interviewId/recording` | Authenticated recording proxy or privacy deletion. |

`POST /api/admin/candidates`

```json
{
  "fullName": "Rahul Patil",
  "email": "rahul@example.test",
  "phone": "+91 90000 00000",
  "position": "React Native Intern",
  "validityHours": 168,
  "singleUse": false
}
```

`POST /api/admin/interviews/:id/decision`

```json
{ "decision": "ACCEPT", "comment": "Strong mobile fundamentals.", "candidateFeedback": "We will contact you with next steps." }
```
