# Security Hardening and Rate Limiting

The **Security Hardening and Rate Limiting** subsystem defends Agent Sauda against automated bot traffic, brute-force attacks, LLM token-drain exploitation, and malicious input injections.

Related: [[Index]], [[Security Model]], [[Deterministic Policy Engine]], [[AI Tool Calling Loop]], [[ADR-022 Production Security Hardening and Distributed Rate Limiting]], [[Phase 20 Security Hardening]]

---

## 🛡️ Multi-Tier Defense Topology

```
                  ┌────────────────────────────────────────┐
                  │          Incoming HTTP Request         │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Helmet Security Header  │
                        │ (HSTS, CSP, X-Frame-Opt)  │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Distributed Rate Limit  │
                        │    (Redis / In-Memory)    │
                        └─────────────┬─────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
      /api/auth/*             /api/agent/chat           Global Routes
      (5 req / min)           (30 req / min)           (120 req / min)
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │    Input Sanitizer (XSS)  │
                        │ (Strip <script>, iframes) │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Deterministic Engine    │
                        │ (Immune to Prompt Hacks)  │
                        └───────────────────────────┘
```

---

## 🔒 Security Principles
1. **Defense in Depth:** Attacks are stopped at the network perimeter (headers & rate limits) before triggering compute or database transactions.
2. **Quota Protection:** High-cost LLM generation is restricted to 30 requests/minute per client IP to safeguard merchant budgets.
3. **Mathematical Invariant:** No matter how persuasive or deceptive a prompt injection is, backend mathematical functions evaluate all deals against merchant margin guardrails.
