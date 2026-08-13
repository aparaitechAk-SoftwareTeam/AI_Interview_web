# End-to-end acceptance matrix

The automated backend tests cover validation, malformed AI JSON rejection, authorization gates, private-file signature handling, score aggregation and integrity separation. Run `npm test` after install.

The following device/system scenarios are acceptance cases for a Development Build connected to a non-production MongoDB database. The mobile app and API include the indicated recovery path.

| Scenario | Expected result / implemented control |
| --- | --- |
| Valid / invalid / expired / revoked invitation | Server verifies code, expiry and revocation; the app renders the exact safe error. |
| Candidate restarts / temporary network loss | Candidate tokens and current interview recovery are saved securely; idempotent answer retry returns the same response. |
| Microphone / camera denied | System check blocks start with an accessible settings instruction. |
| Resume parse failure / unsafe file | File signature/MIME/size validation rejects it; candidate can retry another file. |
| AI timeout / malformed JSON | Timeout, retry cap, Zod validation and safe 503; persisted answer can be retried. |
| Speech recognition failure | Native failure message plus manual answer fallback. |
| Background / Android Back | Events are logged; no silent termination. |
| Face missing / multiple faces | Requires the documented optional native vision module; this build does not fabricate those events. |
| Recording upload failure | Chunk upload is idempotent; pending local upload is retried on reconnect. |
| Successful finish | Final assessment is generated from stored Q&A evidence; candidate sees completion only. |
| Admin review / accept / reject / reinterview | Admin JWT + Mongo persistence + append-only audit log. |
| Candidate result / cross-candidate attempt | Candidate JWT scope and session version block other candidate IDs; final status is safe. |
| Unauthorized admin API | Admin JWT middleware rejects request before controller. |
| Brute force | Invitation and login rate limits are active. |
| Duplicate network submission | `(interviewId,idempotencyKey)` and one-answer-per-question indexes prevent duplication. |

## Required real-device sign-off

Before production, test camera, microphone, native speech recognition, background behavior and camera-video recording on an Android Development Build. Verify at least ten consecutive spoken questions, interrupt and restore the network during final upload, confirm resumed missing-chunk upload reaches 100%, and play the authenticated video with audio from the candidate's admin profile. Full-screen capture and face/gaze landmark detection are intentionally not claimed: they need separate native modules, store disclosures and device-specific validation.
