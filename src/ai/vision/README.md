# src/ai/vision — Cargo Vision
**Purpose:** Verify a DECLARED item from photos: match to declaration, condition (dispute evidence), prohibited flag. Send Package only.
**Future APIs:** /api/scan/* (create[draft], upload-urls, finalize, analyze, poll, evidence).
**Safety:** Server-side Gemini; keys never on client. Images to object storage (presigned), not droplet. Analyzes FRAMES (jpeg). Prohibited = hard stop. Sanctioned-goods flagging advisory, not legal.
**Data:** declared item/category, 2-3 photos (frames), auth token.
**Outputs:** {match, condition, prohibited, status: verified|flagged|rejected}.
