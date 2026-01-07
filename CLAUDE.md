# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CGIWorkFlo.com is a mobile-first React application for managing After Action Reports (AARs) in the automotive repair industry. The application supports role-based access (Admin, Manager, Franchisee, Employee) with comprehensive features for submitting, browsing, and analyzing repair documentation.

**Key characteristic**: 50%+ mobile usage - prioritize touch targets, responsive design, and mobile performance in all implementations.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Architecture

### Technology Stack
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (mobile-first approach)
- **UI Components**: Headless UI/Radix
- **Icons**: lucide-react
- **Forms**: react-hook-form + zod validation
- **Photo handling**: react-dropzone
- **Carousels**: react-slick
- **i18n**: react-i18next (en, fr, de, es, ja)

### Data Architecture
- **No backend**: All data managed via mock files and localStorage
- **Mock data location**: Typically in `src/mocks/` or similar
- **Persistence**: localStorage for simulating state persistence
- **Deployment target**: Cloudflare Pages

### Role-Based Access Control
Four user roles with distinct permissions:
- **Admin**: Full access including user creation, form customization, analytics
- **Manager**: Similar to Admin but cannot create users
- **Franchisee**: Submit/view AARs, create employees
- **Employee**: Submit/view AARs only (attributed to their franchise)

Authentication is mocked via simple form with role selection.

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
