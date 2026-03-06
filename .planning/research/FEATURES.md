# Feature Research

**Domain:** Bug reporting webapp with recording, transcription, and ticketing
**Researched:** 2026-03-07
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-click recording start/stop | Loom/Jam set this standard; any friction = abandonment | LOW | Single button toggles recording state. Visual indicator (red dot, timer) is mandatory |
| Mode selector (audio / video+audio / screen) | Core requirement; user must pick capture type before recording | LOW | Tab or segmented control UI. Default to audio-only as simplest mode |
| Real-time transcription display | Users need to see their words appearing live to trust the system works | MEDIUM | Web Speech API `interimResults: true` shows partial text. Must handle `onend` restart for continuous mode |
| Editable transcript before submission | Speech recognition makes errors; users must correct before ticket creation | LOW | Simple textarea pre-filled with transcript. Critical for Spanish accuracy |
| AI summary generation (title + bullets) | Core value prop -- "describe problem, get structured ticket" | MEDIUM | Claude API call via backend proxy. Show loading state, allow editing of result |
| ClickUp ticket creation | End goal of the entire flow | MEDIUM | POST to ClickUp API via Express proxy. Must show success confirmation with link to created ticket |
| Manual fields (username, projectId, assetId) | Required context ClickUp can't auto-detect | LOW | Modal or form section. Consider localStorage to remember last-used values |
| File attachment to ticket | Visual evidence is the whole point | MEDIUM | ClickUp Attachments API supports multipart/form-data, max 1GB. Two-step: create task, then attach files |
| Recording timer/duration display | Users need to know how long they've been recording | LOW | Simple elapsed time counter visible during recording |
| Permission handling with clear messaging | Browser requires mic/camera/screen permissions; denial must be explained | LOW | Catch `getUserMedia`/`getDisplayMedia` rejections, show guidance on how to grant permissions |

### Differentiators (Competitive Advantage)

Features that set BugShot apart from generic recording tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero-friction bug-to-ticket pipeline | Unlike Jam/Loom, the output IS the ticket -- no copy-paste, no context switching | LOW | This is architecture, not a feature. The linear flow (record -> transcribe -> summarize -> create ticket) is the product |
| AI-structured ticket format | Claude generates title + prioritized bullet points, not just raw transcript | LOW | Prompt engineering. Structure: title, steps to reproduce, expected vs actual, severity suggestion |
| Remember user context (localStorage) | Field workers reuse same username/project -- don't make them retype | LOW | Store username, recent projectIds, recent assetIds in localStorage. Dropdown of recent values |
| Recording preview before submission | Let user replay recording and review transcript before creating ticket | MEDIUM | Use Blob URL for playback. Audio/video `<element>` with controls. User can re-record if unsatisfied |
| Photo capture from camera | Quick snap of physical installation issues without full video | LOW | `getUserMedia` with `{ video: true }` + canvas capture. Simpler than video recording |
| Multiple attachment support | Bug might need several photos + one video | MEDIUM | Array of files to attach. ClickUp API supports sequential attachment uploads |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this prototype.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Server-side transcription (Whisper) | Better accuracy than Web Speech API | Adds API cost, latency, backend complexity, file upload pipeline. Overkill for prototype | Web Speech API is free, real-time, and good enough for structured summaries. Claude can compensate for transcript errors in the summary step |
| Offline recording + sync | Field workers may have poor connectivity | Massive complexity: IndexedDB storage, background sync, conflict resolution, retry queues | Require connectivity. If offline, user records with phone's native app and uses BugShot later. Web Speech API requires network anyway (sends audio to Google/Apple servers) |
| Real-time collaboration | Multiple people annotating same bug | Way beyond scope, introduces WebSocket complexity, state sync | Single-user tool. Share the ClickUp ticket link for collaboration |
| Video editing / trimming | Users want to cut unnecessary parts | Complex UI (timeline, frame-accurate cuts), ffmpeg dependency | Keep recordings short (under 2 min). Re-record if needed |
| Custom ClickUp field mapping | Different teams use different custom fields | Configuration UI complexity, field type validation | Hardcode the 3 fields (username, projectId, assetId). Add more fields only when validated |
| Automatic console/network log capture | Jam does this for developer bug reports | BugShot users are installers reporting physical issues, not web developers. Requires browser extension | Out of scope. Physical installation bugs don't have console logs |
| User authentication | "We need to know who reported" | Prototype is internal, adds auth complexity | Username field in the form. Auth can be added post-validation |
| Push notifications | Notify when ticket is created/updated | Requires service worker, notification permissions, adds complexity | Show success confirmation inline. User can check ClickUp directly |

## Feature Dependencies

```
[Audio Recording (MediaRecorder)]
    |-- requires --> [Microphone Permission]
    |-- produces --> [Audio Blob]
    |-- enables  --> [Real-time Transcription (Web Speech API)]
                        |-- produces --> [Transcript Text]
                        |-- enables  --> [AI Summary (Claude API)]
                                            |-- produces --> [Title + Bullets]
                                            |-- enables  --> [Ticket Creation (ClickUp API)]
                                                                |-- enables --> [File Attachment]

[Video Recording (Camera + Audio)]
    |-- requires --> [Camera + Microphone Permission]
    |-- shares   --> [Audio Recording] (same mic audio feeds transcription)
    |-- produces --> [Video Blob]

[Screen Recording]
    |-- requires --> [getDisplayMedia Permission]
    |-- requires --> [Microphone Permission] (separate getUserMedia call)
    |-- requires --> [Audio Stream Mixing] (WebAudio API to merge mic + system audio)
    |-- produces --> [Video Blob]
    |-- shares   --> [Audio Recording] (mic audio feeds transcription)

[Photo Capture]
    |-- requires --> [Camera Permission]
    |-- produces --> [Image Blob]
    |-- independent of --> [Transcription flow]
    |-- feeds    --> [File Attachment]
```

### Dependency Notes

- **Transcription requires audio recording running:** Web Speech API runs in parallel with MediaRecorder. Both use the mic but are independent APIs -- they don't share a stream. SpeechRecognition accesses the mic separately.
- **AI Summary requires transcript:** Cannot generate summary without transcript text. If transcript is empty (user didn't speak), skip summary or show warning.
- **Ticket creation requires summary OR transcript:** At minimum, need text content for the ticket body. Summary is preferred but transcript alone works.
- **File attachment requires ticket ID:** ClickUp API requires task ID to attach files. Must create task first, then attach. Two sequential API calls.
- **Screen recording audio mixing is the hardest dependency:** Combining `getDisplayMedia` audio + `getUserMedia` audio requires WebAudio API (`createMediaStreamSource` + `createMediaStreamDestination`). This is the most technically complex feature.
- **Photo capture is independent:** Can be built without any dependency on the recording/transcription flow. Good candidate for parallel development.

## MVP Definition

### Launch With (v1)

Minimum viable product -- validate that the record-to-ticket flow works.

- [ ] Audio recording with MediaRecorder API -- foundation for everything
- [ ] Real-time transcription with Web Speech API -- core value (no typing)
- [ ] AI summary via Claude API proxy -- structured ticket content
- [ ] ClickUp ticket creation with manual fields -- the deliverable
- [ ] Audio/photo attachment to ticket -- evidence support
- [ ] Mode selector UI -- even if only audio works first, the UI should show all modes

### Add After Validation (v1.x)

Features to add once core audio-to-ticket flow is validated.

- [ ] Video recording (camera + audio) -- when users confirm they need video evidence
- [ ] Screen recording with audio mixing -- most complex mode, defer until audio flow is solid
- [ ] Recording preview/playback before submission -- quality assurance step
- [ ] localStorage for recent field values -- reduce repetitive typing
- [ ] Multiple file attachments per ticket -- when single attachment feels limiting

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Fallback transcription (Whisper API) -- only if Web Speech API accuracy is insufficient for Spanish
- [ ] Offline support with sync -- only if field connectivity is a proven blocker
- [ ] ClickUp custom field configuration -- only if different teams need different fields
- [ ] Batch ticket creation -- only if users report multiple bugs per session

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Audio recording | HIGH | LOW | P1 |
| Real-time transcription | HIGH | MEDIUM | P1 |
| AI summary (Claude) | HIGH | MEDIUM | P1 |
| ClickUp ticket creation | HIGH | MEDIUM | P1 |
| Manual fields (username, projectId, assetId) | HIGH | LOW | P1 |
| Mode selector UI | MEDIUM | LOW | P1 |
| Photo attachment | HIGH | LOW | P1 |
| Recording timer | MEDIUM | LOW | P1 |
| Permission error handling | MEDIUM | LOW | P1 |
| Video recording (camera) | MEDIUM | MEDIUM | P2 |
| Recording preview/playback | MEDIUM | LOW | P2 |
| localStorage for fields | MEDIUM | LOW | P2 |
| Screen recording + audio mix | MEDIUM | HIGH | P2 |
| Multiple attachments | LOW | MEDIUM | P2 |
| Video attachment (large files) | MEDIUM | MEDIUM | P2 |
| Fallback transcription | LOW | HIGH | P3 |
| Offline support | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- the record-to-ticket pipeline
- P2: Should have, add when core flow is validated
- P3: Nice to have, only if evidence supports the need

## UX Patterns (Domain-Specific)

### Recording Flow Pattern

The standard UX for recording apps (established by Loom, Jam, voice memos):

1. **Pre-recording:** Mode selector visible. Big, obvious record button. Permission state shown.
2. **Recording active:** Red pulsing indicator + elapsed timer. Transcript appearing in real-time below. Pause/Resume available. Stop button prominent.
3. **Post-recording:** Preview player. Editable transcript. "Generate Summary" button. Ability to re-record.
4. **Submission:** Summary displayed (editable). Manual fields form. "Create Ticket" action. Success confirmation with ClickUp link.

### Key UX Principles

- **Linear flow, not dashboard:** Record -> Review -> Submit. No navigation, no sidebar, no settings pages.
- **Big touch targets:** Field workers use mobile, often with gloves. Buttons must be large.
- **Visual recording state:** Users must always know if they're being recorded. Red dot + timer is universal.
- **Interim transcription results:** Show gray/italic text for unfinalized words, black for finalized. Users understand "it's still processing."
- **Error recovery:** If Web Speech API stops (it does, frequently), auto-restart `SpeechRecognition`. If it fails entirely, let user type manually.
- **No data loss:** If browser closes during recording, the partial recording should be recoverable where possible (use `timeslice` parameter in MediaRecorder to capture chunks).

### Web Speech API UX Considerations

- **Auto-restart pattern:** Web Speech API fires `onend` after silence. Must detect and restart with `recognition.start()` to maintain continuous transcription. Add a small delay to avoid rapid restart loops.
- **Language setting:** Set `recognition.lang = 'es-ES'` for Spanish. Critical for accuracy with Spanish-speaking field workers.
- **Chrome on iOS does NOT support Web Speech API** (uses WebKit, not Chromium engine). Safari on iOS does support it from version 14.1+. Users on iPhone must use Safari.
- **Network dependency:** Both Chrome and Safari send audio to cloud servers (Google/Apple) for processing. No offline transcription possible.

## Competitor Feature Analysis

| Feature | Loom | Jam | BugShot (Our Approach) |
|---------|------|-----|------------------------|
| Recording modes | Screen, camera, both | Screen only (extension) | Audio, camera, screen |
| Transcription | AI-generated post-recording | AI transcription of voiceover | Real-time during recording (Web Speech API) |
| Bug ticket creation | Manual copy to Jira/Linear | Auto-creates Jira/Linear tickets | Auto-creates ClickUp tickets |
| Technical context | None | Console logs, network, clicks | None (physical installation bugs) |
| AI summary | AI-generated title + chapters | AI summary of recording | Claude-generated title + structured bullets |
| Target user | Knowledge workers | Developers/QA | Field installers / support |
| Platform | Browser extension + desktop app | Browser extension | Webapp (no install) |
| Cost | Freemium ($15/user/mo) | Free for individuals | Internal tool (free) |

## Sources

- [MDN: Using the Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)
- [MDN: MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Can I Use: Speech Recognition](https://caniuse.com/speech-recognition)
- [AddPipe: getDisplayMedia with microphone demo](https://addpipe.com/getdisplaymedia-demo/)
- [Chrome Dev: Screen recording with mic and desktop audio](https://dev.to/chromiumdev/screen-recorder-recording-microphone-and-the-desktop-audio-at-the-same-time-4c0o)
- [ClickUp API: Create Task Attachment](https://developer.clickup.com/reference/createtaskattachment)
- [Loom: Bug Reporting Tools](https://www.loom.com/blog/bug-reporting-tools)
- [Jam.dev](https://jam.dev/)
- [web.dev: Screen Record Pattern](https://web.dev/patterns/media/screen-record)
- [AddPipe: Deep Dive into Web Speech API](https://blog.addpipe.com/a-deep-dive-into-the-web-speech-api/)
- [VideoSDK: JavaScript Speech Recognition 2025](https://www.videosdk.live/developer-hub/stt/javascript-speech-recognition)

---
*Feature research for: Bug reporting webapp with recording, transcription, and ticketing*
*Researched: 2026-03-07*
