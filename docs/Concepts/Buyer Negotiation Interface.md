# Buyer Negotiation Interface

The **Buyer Negotiation Interface** is the public-facing conversational e-commerce storefront where shoppers interact with the autonomous AI sales agent to explore products, request bundle discounts, and accept formal quotes.

Related: [[Index]], [[AI Tool Calling Loop]], [[Offer Lifecycle State Machine]], [[ADR-017 Public Buyer Conversational Negotiation UI]], [[Phase 15 Public Buyer Chat UI]]

---

## 🎨 Component Architecture

```
[/negotiate/[merchantSlug]]
        │
        ├──► [ Navbar ] (Store name, Catalog drawer toggle, Policy indicator)
        │
        ├──► [ CatalogBrowser ] (Drawer: Search, Categories, In-Stock chips, "Negotiate Price")
        │
        └──► [ ChatInterface ]
                 │
                 ├──► Message Stream (User bubbles, Agent bubbles, Typing loaders)
                 │
                 ├──► [ OfferCard ] (Live quote, Discount savings badge, Accept/Decline CTA)
                 │
                 └──► Suggestion Chips & Message Input Bar
```

---

## ⚡ User Journey
1. **Discovery:** Buyer opens `http://localhost:3000/negotiate/quantum-dynamics`.
2. **Product Selection:** Buyer opens the catalog drawer and selects *"Quantum Processor Q-1"*.
3. **Conversational Counter-Offer:** Buyer types *"Can you give me a 10% discount for 2 units?"*.
4. **Policy-Evaluated Response:** Agent verifies gross margin with the policy engine and renders an interactive **Offer Card** with savings breakdown.
5. **Acceptance:** Buyer clicks **"Accept & Checkout"** $\rightarrow$ Triggers atomic stock reservation and advances to checkout.
