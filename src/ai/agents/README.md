# src/ai/agents — Agent Orchestration
**Purpose:** Shared base for all Chapar AI agents (concierge, shopping, send). Mode router (buy/send) + common chat loop.
**Future APIs:** /api/ai/chat (modes: buy, send), defensive JSON, per-mode prompt+schema; future tool-calling for search/scan.
**Safety:** Server-side only; keys never on client. Never invent policy (use 01 + 08). Never 500 on parse failure — fall back to raw reply.
**Data:** messages[], language, userName, mode, optional image/frames.
**Outputs:** buy {reply,resolved,browse,searchQuery,product}; send {reply,needPhotos,collected{...},done}.
