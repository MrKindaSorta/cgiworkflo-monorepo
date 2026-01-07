## UPDATED: Production Full-Stack Application (January 2026)

CGIWorkFlo.com is now a **production-ready full-stack application** deployed on Cloudflare infrastructure with real backend API, database, and authentication.

**Live URLs:**
- Frontend: https://cgiworkflo-monorepo.pages.dev
- Backend API: https://cgiworkflo-api.joshua-r-klimek.workers.dev
- Repository: https://github.com/MrKindaSorta/cgiworkflo-monorepo

**Architecture:**
- **Frontend:** React 19 + Vite (Cloudflare Pages)
- **Backend:** Cloudflare Workers + Hono framework
- **Database:** Cloudflare D1 (SQLite with 20 tables, FTS5 search)
- **Storage:** Cloudflare R2 (photos/attachments)
- **Auth:** JWT tokens with bcrypt password hashing

**What's Implemented:**
✅ Complete frontend UI (mobile-first, dark mode, 5 languages)
✅ JWT authentication system
✅ Login with email/password OR quick dev login buttons
✅ Database schema with users, aars, photos, comments, votes, messaging
✅ 4 demo accounts (admin@demo.com, manager@demo.com, franchisee@demo.com, employee@demo.com - password: demo123)
✅ API endpoints: /auth/register, /auth/login, /auth/me, /auth/logout, /auth/dev-login
✅ Auto-deployment via GitHub → Cloudflare

**What's Next:**
- AAR CRUD API endpoints
- Photo upload to R2
- Search/filtering with FTS5
- Chat API with polling or WebSockets
- Analytics endpoints

---

## Original Specification (Reference)

Mobile-first React frontend for CGIWorkFlo.com using Tailwind CSS. Extremely responsive, 50%+ mobile usage — perfect touch targets, fast load, smooth desktop/mobile experience. Support light/dark modes globally.

User roles (now with real JWT authentication):

Admin: full access (edit/delete AARs, customize forms, analytics, user creation)
Manager: similar to Admin but no user creation
Franchisee: submit/view all AARs, create employees
Employee: submit/view, AARs attributed to "Employee of [FranchiseeName]"

Authentication: Simple form (name, email, role, address); Franchisee/Admin/Manager create users via modal (name, email, role, address, phone).
Features:

Role-based login screen
Navigation: Desktop sidebar; Mobile bottom nav + collapsible drawer
Dashboard: Grid/list of recent AARs; stats for Admin/Manager (AARs today/week/month, materials used, unique views)
Submit AAR form (react-hook-form + zod):
Cascading creatable dropdowns: Category (Vehicle/Boat/Motorcycle/Apparel/Accessory/Furniture/Aircraft/Marine/Medical/Commercial) → Sub-category (e.g., Make) → Model → Year → Color → Material → Damage Type/Description
Other fields: Job Type, Repair Time (hours), Tools Used, Notes, Process Description (textarea), Paint/Dye Mix (textarea)
Units: Area (sq m/ft), Liquid (ml/oz, l/gal); input in any, store preference, auto-convert on view
Multi-photo uploads (react-dropzone): Unlimited before/after, preview carousel (react-slick)
Private cost input; public display: average (calc from mocks) or range if data, blank if none; Admin/Manager edit

Custom AAR form (Admin/Manager): Reorder/add/remove fields, nest up to 3 levels (conditional fields based on selections)
Browse AARs: Filterable/searchable list (category, make/model/year/material/location/date range/upvotes); full-text search bar (prioritize matches); sortable by relevance
AAR view: Details, photo carousel, process, comments section, upvote/downvote with reason, thumbs up/down on comments

Interactions: Comments per AAR/message; upvote/downvote counters
Chat: DMs/groups; create/add/remove users; reply to messages; thumbs up/down; socket mocks (use state for auto-refresh)
Internationalization: react-i18next; support en, fr, de, es, ja; language selector, auto-detect
Notifications: In-app for upvotes/thumbs on AARs/comments/messages (mock list)
Profile: Role/details, own AARs
Branding: Admin page for logo upload, color picker (Tailwind vars)
Analytics (Admin/Manager): Comprehensive dashboard with metrics (AAR counts, materials, stats)

Use:

React 18 + Vite
Tailwind CSS (mobile-first)
Headless UI/Radix for UI components
lucide-react icons
Mock data in files (AAR array, users); localStorage for persistence

Output full project structure with key files (App.jsx, components, mocks). Runnable with npm create vite@latest. Concise, modern code.