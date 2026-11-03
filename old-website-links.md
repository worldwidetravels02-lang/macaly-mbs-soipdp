# Old Website: Links & Page Inventory

Source: `https://oberoirealityonlinepromotions.com` (scraped 2026-10-28)

## What the old site was

A channel-partner promotional portal for **Oberoi Realty** (Mumbai luxury residential developer).
It was essentially a **login gateway**, not a marketing site: a centred logo, the line
"Redefining Urban Living", a Login button, a Sign Up link, and one "Residential" paragraph.
The only real functionality was account registration/login, which then unlocked a customer home.

New brand for the redesign: **Msheireb Properties** (same format: luxury residences + member portal), relocated to **Dubai, UAE** with AED pricing.

## Internal links found

| Old link | Purpose | Status in redesign |
| --- | --- | --- |
| `/` | Homepage (logo, tagline, Login, Sign Up, Residential blurb) | Implemented (redesigned) |
| `/register` | Sign Up form: name, email, mobile, referral code, password, confirm password | Implemented (`/register`) |
| `Login` (button) | Posts credentials, lands on the customer home | Implemented (`/login`) |
| `/customerHome` | Customer dashboard behind login | Implemented as `/account` |
| `https://oberoirealityonlinepromotions.com/` | Absolute home link (logo click) | Implemented (internal link) |
| `https://oberoirealityonlinepromotions.com:443/register` | Absolute register link | Implemented (internal `/register`) |

## Language / currency switcher found

| Old link | Purpose | Status |
| --- | --- | --- |
| `Language` | Locale switch (no target URL, JS only) | Not carried over (English only) |
| `INR` / `USD` / `AED` | Currency switch (no target URL, JS only) | Not carried over (AED only) |

## Assets found on the old site

| Asset | Note |
| --- | --- |
| `/images/header/Logo.jpg` | Oberoi Realty logo (old brand, replaced by new Msheireb mark) |
| `/images/header/announcement-icon.png` | Small megaphone icon next to "Welcome to Oberoi Realty" |
| `/images/header/lang-icon.png` | Globe icon for the language menu |
| `/images/admin-page-image/favicon.jpg` | Old favicon |
| `canvas/css/style.css`, `style-library.css`, `js-swiper.css`, `font-icons.css`, `components/*.css` | Theme CSS (Canvas Bootstrap template), not reused |
| `assets/css/sweetalert2.min.css` | Alert library CSS, not reused |

No photography existed on the old site, so all imagery in the redesign is newly generated.

## Content carried over

- "Redefining Urban Living" (hero tagline)
- "Built on a legacy of elegance, style, and lifestyle, our residential apartments offer the
  superlative standard of living. With quality construction, world-class amenities and an
  impeccable reputation, our projects are the most enviable residences in Mumbai." (Residential section)
- Login / Sign Up as the primary account actions
- Mobile-number based sign up with an optional referral code

## To-do list for the remaining pages

- [x] **Homepage** - hero, residential section, residences, amenities, legacy, member portal, contact
- [x] **Sign Up (`/register`)** - name, email, mobile, referral code, password, confirm password, validation
- [x] **Login (`/login`)** - email + password, error states, redirect to member account
- [x] **Member account (`/account`)** - profile details, referral code, advisor, residences to preview, sign out
- [x] **Forgot password / reset** - emailed code, new password
- [x] **Residences listing (`/residences`)** - all addresses with price, size, handover
- [x] **Residence detail** - `/residences/palm-jumeirah`, `/residences/downtown`, `/residences/marina`: gallery, features, enquiry form
- [x] **About (`/about`)** - practice story, milestones, statistics
- [x] **Amenities (`/amenities`)** - pool, club, spa, concierge, valet
- [x] **Contact (`/contact`)** - sales gallery details, enquiry form with residence selector
- [x] **Legal** - `/privacy`, `/terms` (with RERA disclosures anchor)
- [ ] **Language switcher** (EN / AR) and **currency switcher** - not carried over; the site is English with AED pricing

Every internal link on the site now points at a page that exists. There are no placeholder notices left.
