# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CGIWorkFlo.com is a **production-ready**, mobile-first full-stack application for managing After Action Reports (AARs) in the automotive repair industry. The application supports role-based access (Admin, Manager, Franchisee, Employee) with comprehensive features for submitting, browsing, and analyzing repair documentation.

**Key characteristic**: 50%+ mobile usage - prioritize touch targets, responsive design, and mobile performance in all implementations.

## Live Deployment

- **Frontend:** https://cgiworkflo-monorepo.pages.dev (Cloudflare Pages)
- **Backend API:** https://cgiworkflo-api.joshua-r-klimek.workers.dev (Cloudflare Workers)
- **Repository:** https://github.com/MrKindaSorta/cgiworkflo-monorepo

## Development Commands

### Frontend
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend
```bash
cd backend

# Start local development server with D1
npm run dev

# Deploy to Cloudflare Workers
wrangler deploy --env=""

# Database operations
npm run db:migrate:dev    # Apply migrations locally
npm run db:seed          # Seed demo users
npm run db:console       # Open D1 console
```

## Architecture

### Technology Stack

**Frontend:**
- **Framework**: React 19 + Vite 7
- **Styling**: Tailwind CSS v3 (mobile-first approach)
- **UI Components**: Headless UI/Radix
- **Icons**: lucide-react
- **Forms**: react-hook-form + zod validation
- **Photo handling**: react-dropzone
- **HTTP Client**: axios
- **i18n**: react-i18next (en, fr, de, es, ja)

**Backend:**
- **Runtime**: Cloudflare Workers
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **File Storage**: Cloudflare R2 (photos, attachments)
- **Caching**: Cloudflare KV Namespace
- **Authentication**: Custom JWT with bcrypt password hashing

### Data Architecture

**Production (Current):**
- **Backend API**: Cloudflare Workers + Hono
- **Database**: Cloudflare D1 with 20 tables, FTS5 full-text search
- **Authentication**: JWT tokens (7-day expiration, HS256 algorithm)
- **File Storage**: Cloudflare R2 for photos
- **Database Tables**: users, aars, photos, comments, votes, conversations, messages, notifications, branding, custom_forms, categories, materials
- **Indexes**: Comprehensive indexes for search/filtering (category, material, date, upvotes)
- **Triggers**: Auto-update denormalized counts (votes, comments, views)

**Development (Legacy):**
- Mock data files in `src/mocks/` (being phased out)
- localStorage for temporary persistence
- Will be replaced with API calls

### Database Schema Highlights

**Key Tables:**
1. **users** - Authentication, roles, preferences, franchise relationships
2. **aars** - Complete AAR data with measurements, costs, engagement metrics
3. **aars_fts** - FTS5 virtual table for full-text search
4. **photos** - R2 file references (before/after)
5. **comments** - AAR comments with reactions
6. **aar_votes** - Upvote/downvote tracking with deduplication
7. **conversations** - DMs, groups, open chat
8. **messages** - Chat messages
9. **notifications** - User notifications

**Schema Features:**
- Full-text search with SQLite FTS5 (auto-synced via triggers)
- Denormalized counts for performance (upvotes, downvotes, views, comment_count)
- Soft deletes (deleted_at column)
- Foreign keys with cascading deletes
- Comprehensive indexes for filtering and sorting

### Role-Based Access Control

**Implemented with JWT + Middleware:**
- **Admin**: Full access including user creation, form customization, analytics
- **Manager**: Similar to Admin but cannot create users
- **Franchisee**: Submit/view AARs, create employees (franchise_id linkage)
- **Employee**: Submit/view AARs (attributed to their franchise)

**Authentication Flow:**
1. User logs in with email/password
2. Backend verifies credentials (bcrypt compare)
3. Backend generates JWT token (includes id, email, role, franchiseId)
4. Frontend stores token in localStorage
5. All API requests include token in Authorization header
6. Backend middleware validates token on protected routes

### Key Features & Components

**AAR Submission Form**
- Cascading creatable dropdowns with hierarchy: Category → Sub-category (Make) → Model → Year → Color → Material → Damage Type
- Categories: Vehicle, Boat, Motorcycle, Apparel, Accessory, Furniture, Aircraft, Marine, Medical, Commercial
- Unit conversion system: Area (sq m/ft), Liquid (ml/oz, l/gal) - store user preference and auto-convert on display
- Multi-photo uploads with before/after organization
- Private cost tracking with public display showing averages/ranges

**Custom Form Builder** (Admin/Manager only)
- Reorder, add, remove fields dynamically
- Support nested conditional fields up to 3 levels deep
- Based on user selections in parent fields

**AAR Browse & Search**
- Full-text search with relevance-based prioritization
- Filters: category, make/model/year, material, location, date range, upvotes
- Sortable results

**Interaction System**
- Comments on AARs with thumbs up/down
- Upvote/downvote on AARs with reason submission
- Chat system with DMs and groups
- Mock socket connections using state for auto-refresh

**Responsive Navigation**
- Desktop: Sidebar navigation
- Mobile: Bottom navigation bar + collapsible drawer

**Theming & Branding**
- Global light/dark mode support
- Admin-configurable branding: logo upload, color customization via Tailwind CSS variables

## Development Guidelines

### Mobile-First Approach
Always implement mobile layouts first, then enhance for larger screens. Ensure:
- Touch targets are minimum 44x44px
- Fast load times and optimized images
- Smooth transitions and interactions on touch devices

### Unit Conversion
When implementing measurement inputs:
- Allow input in any supported unit
- Store user's preferred unit in localStorage
- Auto-convert for display based on viewer's preference
- Supported conversions: sq m ↔ sq ft, ml ↔ oz, l ↔ gal

### Form Validation
Use react-hook-form + zod for all forms. Ensure validation messages are clear and internationalized.

### Mock Data Patterns
- Keep mock data structures consistent with what a real API would return
- Use localStorage to persist changes during development
- Implement helper functions to simulate async operations (setTimeout) for realistic UX

### Internationalization
- All user-facing text must use react-i18next translation keys
- Support languages: English, French, German, Spanish, Japanese
- Include language selector in UI
- Implement auto-detection based on browser settings

---

## API Endpoints (Implemented)

### Authentication (Public)
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Login with email/password, returns JWT
- `POST /api/auth/dev-login` - Quick demo login by role (admin/manager/franchisee/employee)
- `GET /api/auth/me` - Get current user profile (protected)
- `POST /api/auth/logout` - Logout (protected)

### Demo Accounts
All use password: `demo123`
- **admin@demo.com** - Admin Demo (full access)
- **manager@demo.com** - Manager Demo
- **franchisee@demo.com** - Franchisee Demo
- **employee@demo.com** - Employee Demo

### To Be Implemented
- AAR CRUD operations
- Photo upload to R2
- Search and filtering
- Voting and comments
- Messaging system
- Analytics endpoints
- User management
- Branding customization

---

## File Structure

### Frontend (Current Directory)
```
/mnt/c/Users/Josh Klimek/Desktop/CGIWorkFlo.com/
├── src/
│   ├── components/       # UI components
│   ├── contexts/         # React contexts (Auth, AAR, Theme)
│   ├── pages/            # Page components
│   ├── mocks/            # Mock data (being phased out)
│   ├── utils/            # Utility functions
│   ├── i18n/             # Internationalization
│   └── lib/
│       └── api-client.ts # API client with axios
├── public/               # Static assets
├── _redirects           # Cloudflare Pages redirects
├── _headers             # Security headers
├── .env.development     # Development env vars
├── .env.production      # Production env vars
└── package.json

backend/
├── src/
│   ├── index.ts         # Main Hono app
│   ├── routes/
│   │   └── auth.ts      # Authentication routes
│   ├── middleware/
│   │   └── auth.ts      # JWT auth middleware
│   ├── lib/
│   │   ├── jwt.ts       # JWT utilities
│   │   └── hash.ts      # Password hashing
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 0001_initial_schema.sql
│   │   └── seed.sql     # Demo users
│   └── types/
│       └── env.ts       # TypeScript types
├── wrangler.toml        # Cloudflare Workers config
└── package.json
```

---

## Environment Variables

### Frontend (.env.development)
```env
VITE_API_BASE_URL=https://cgiworkflo-api.joshua-r-klimek.workers.dev/api
VITE_APP_NAME=CGIWorkFlo
VITE_MAX_PHOTO_SIZE=10485760
```

### Backend (wrangler.toml + secrets)
- **D1 Database:** `cgiworkflo-db-production`
- **R2 Bucket:** `cgiworkflo-photos-production`
- **KV Namespace:** `CACHE`
- **Secret:** `JWT_SECRET` (set via `wrangler secret put JWT_SECRET`)

---

## Current Implementation Status

### ✅ Completed
1. **Infrastructure**
   - Cloudflare Workers backend deployed
   - Cloudflare D1 database with complete schema
   - Cloudflare R2 buckets created
   - Cloudflare Pages frontend deployed
   - GitHub repository with CI/CD auto-deployment

2. **Authentication System**
   - JWT token generation (jose library)
   - Password hashing (bcryptjs, 10 rounds)
   - Auth middleware (protect routes, validate tokens)
   - Login/register/me/logout endpoints
   - Dev login for quick role-based testing
   - 4 demo users seeded (admin, manager, franchisee, employee)

3. **Frontend**
   - Complete UI for all pages (Dashboard, Browse, Submit, Chat, Profile, Analytics, etc.)
   - Login page with email/password + 4 dev login buttons
   - API client with axios (JWT interceptors, error handling)
   - Responsive mobile-first design
   - Dark mode support
   - Multi-language support (5 languages)

### ⏳ In Progress / To Do
1. **AAR API Integration**
   - Refactor AARContext to use API instead of localStorage
   - Implement AAR CRUD endpoints
   - Photo upload to R2
   - Search and filtering with FTS5

2. **Chat API Integration**
   - Implement messaging endpoints
   - Real-time or polling-based updates
   - Conversation management

3. **Additional Features**
   - Analytics endpoints
   - User management API
   - Branding customization API
   - Custom forms API

---

## Development Workflow

### Making Changes

1. **Frontend changes:**
   ```bash
   # Edit files in src/
   git add .
   git commit -m "Your changes"
   git push origin main
   # Cloudflare Pages auto-deploys
   ```

2. **Backend changes:**
   ```bash
   cd backend
   # Edit files in src/
   npm run build  # Test build
   wrangler deploy --env=""  # Deploy to Cloudflare
   cd ..
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

3. **Database changes:**
   ```bash
   cd backend
   # Create new migration file
   # Edit src/db/migrations/XXXX_description.sql
   wrangler d1 execute cgiworkflo-db-production --file=src/db/migrations/XXXX_description.sql --remote
   ```

### Testing Locally

1. **Backend:**
   ```bash
   cd backend
   npm run dev
   # Runs on http://localhost:8787
   ```

2. **Frontend:**
   ```bash
   npm run dev
   # Runs on http://localhost:3000
   # Proxies /api/* to backend
   ```

3. **Database:**
   ```bash
   cd backend
   npm run db:console  # Interactive SQL console
   # Or specific query:
   wrangler d1 execute cgiworkflo-db-development --command "SELECT * FROM users" --local
   ```

---

## Important Notes for Claude

### When Adding New Features

1. **Backend API First:**
   - Create route in `backend/src/routes/`
   - Add authentication/authorization middleware
   - Use Zod for validation
   - Register route in `backend/src/index.ts`
   - Deploy with `wrangler deploy`

2. **Frontend Integration:**
   - Add method to `src/lib/api-client.ts`
   - Update relevant Context (AuthContext, AARContext, etc.)
   - Test with demo accounts
   - Commit and push (auto-deploys)

3. **Database Changes:**
   - Create migration SQL file
   - Test locally first
   - Apply to production database
   - Document schema changes

### Security Considerations

- All passwords hashed with bcrypt (10 rounds)
- JWT tokens expire after 7 days
- CORS configured to allow only *.pages.dev and specific domains
- Protected routes require valid JWT
- Role-based permissions enforced at API level
- Input validation with Zod on all endpoints
- Parameterized queries prevent SQL injection

### Performance Best Practices

- Use FTS5 for full-text search (not LIKE queries)
- Denormalized counts avoid expensive JOINs
- Indexes on all foreign keys and filter columns
- Pagination for large result sets (20 items default)
- Soft deletes preserve referential integrity

---

## Quick Reference

### Demo Login (Development)
Click one of the 4 colored buttons on login page, or:
- Email: `admin@demo.com`
- Password: `demo123`

### API Testing
```bash
# Health check
curl https://cgiworkflo-api.joshua-r-klimek.workers.dev/api/health

# Login
curl -X POST https://cgiworkflo-api.joshua-r-klimek.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'

# Get user profile
curl https://cgiworkflo-api.joshua-r-klimek.workers.dev/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Database Queries
```bash
# List all users
wrangler d1 execute cgiworkflo-db-production --command "SELECT id, name, email, role FROM users" --remote

# Count AARs
wrangler d1 execute cgiworkflo-db-production --command "SELECT COUNT(*) FROM aars" --remote
```
