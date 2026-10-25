# Tryumph Gym roadmap

## Current launch cleanup
- [ ] Hide nutrition and homeschool content for the adult fitness launch
- [ ] Isolate creator Trybes; combined feed includes joined groups only
- [ ] Share expanded goals between profiles and creator uploads; verify saving and matching

## Phase 1 (done in this pass) — working front-end with saved-on-device state
- [x] Design system (charcoal + electric teal)
- [x] Nav: Home | On-Demand | Nutrition | Live | Trainers | Trybes | Wallet | Account
- [x] Home hub, on-demand library w/ filters, water-break ad, watch later, history
- [x] Live classes: free reserve, $5 token deducted on Join
- [x] Trainer directory + profiles, 1-on-1 booking, kind-review check
- [x] Trybes feed, accountability partners
- [x] Wallet + token purchase (simulated), ledger
- [x] Account health baseline incl. postpartum / diastasis recti
- [x] Trainer dashboard (analytics, earnings splits, scheduler, roster)
- [x] Shop placeholders (Tryumph Fit, Trybe Stores, future hooks)

## Phase 2 (needs decisions from user)
- [x] Real accounts + cloud data (Lovable Cloud) — email + Google sign-in, profiles/tokens/bookings saved online
- [x] Move Trybe posts, reviews, partners into shared cloud tables
- [x] Real payments — Stripe test checkout verified end-to-end: card payment completes, webhook credits the wallet; trainer payouts (Connect) still to do
- [x] Live video rooms (LiveKit) — keys saved; live classes join real video rooms with camera/mic controls
- [x] AI review moderation (word filter + AI kindness check)

## Phase 3 refinements (done)
- [x] Guest home without stats, new tagline; on-demand level + style filters; save-for-later needs account
- [x] Nutrition: public meals, weekly menu, grocery list, nutritionist client menus
- [x] Live "Reserve" + reminders; tokens only for lives; 1-on-1s in dollars; no splits shown to clients
- [x] Trybes: trainer + goal groups, friends, partners, partner alerts & chat, moderator tools
- [x] Member onboarding (BMI, goals, needs, why) and trainer application (certs, specialties, client protection)
- [x] Trainer Studio: analytics, calendar with blocked time, uploads w/ 5-video live unlock, store manager; review replies; /for-trainers
- [x] Shared cloud tables for friends/chats; meal plans saved online and shared with nutritionists by code
- [x] Coach roles: Trainer / Nutritionist / Both, add certs anytime (Studio → Credentials)
- [x] Playlists on On-Demand; new-live alerts to joined Trybes
- [x] Admin certification review (/admin); real video uploads to cloud storage; device reminders 10/5/On now while app open
- [x] Owner admin: Mackenzie@tryumphgym.com gets admin automatically on sign-up
- [x] Trainer payouts (Stripe Connect), all splits after fees; admin payout run
- [x] Uploaded videos playable; ads only at trainer-marked water breaks
- [x] Homepage waitlist + admin count/download
- [x] Add waitlist referral source, $5 live-class interest, and new-coach notification preference; include answers in Admin/download (notification preference saved; automatic emails not connected)
- [ ] Ad revenue source — needs an ad partner
- [x] Class alerts when app is closed (device push) — single 10-minute reminder only
- [x] 1-on-1 booking checks the trainer's calendar — blocked time and already-paid slots are hidden and refused
- [x] Published — live-site payment confirmation holds the slot (verified: booked 07:00 shows taken); checkout now returns to the real site address

## Phase 4 (Oct 2026 batch)
- [x] New accounts start with 0 tokens
- [x] Account page Edit / Save / Cancel; finish-profile reminder clears once saved
- [x] Token checkout opens in a new tab inside the editor preview, with sign-in prompts
- [x] Trybes partner suggestions
- [x] Trainer directory filters (role, specialty, price, sort)
- [x] Pregnancy-safe filter + "Pregnant" profile option
- [x] Upload: equipment, pregnancy-safe, playlists, 15/30s breaks with spacing rules; On-Demand gear + time filters
- [x] Personal picks on Home + Follow coaches
- [x] Shop = Tryumph gear only; trainer merch on coach profiles
- [x] Terms page (/terms): member waiver, coach insurance attestation, youth consent, payments — lawyer review before launch
- [x] Music playlist links; Quiet filter; Trybe starter prompts; "$5" copy → "1 token"
- [x] Admin credential verification quick links + visible waitlist list in Admin
- [x] Youth contributor approval gate (guardian consent → admin approval; uploads locked until approved)
- [x] Coach storefront links + FTC disclosure
- [x] 1-on-1 room join buttons
- [x] Members-only Trybe posting
- [x] Equipment & health filters
- [x] Move level/style/gear/safety into profiles; apply automatically on On-Demand; replace guest filter chips with dropdowns and multi-select gear (12 matching tests and guest browser checks passed; signed-in persistence check blocked by unavailable account testing)
- [x] Private Trybe privacy (locked to non-members, hidden from All Trybes feed and partner suggestions)
- [x] Studio "Go live now" broadcasts the coach's camera/mic into the class room
- [x] Self-view camera preview in live rooms
- [x] Studio-scheduled classes show on the public Live page
- [x] Adult coaches need a certification to submit; youth apply via guardian consent
