# CGIWorkFlo.com - Production Deployment Setup Guide

This guide walks you through deploying CGIWorkFlo.com to production on Cloudflare infrastructure.

## Current Status

✅ Git repository initialized and connected to GitHub
✅ Backend skeleton created (`/backend` directory)
✅ D1 database schema defined
✅ Cloudflare configuration files created
✅ Security headers and redirects configured

## Prerequisites

1. **Cloudflare Account** - Sign up at https://cloudflare.com
2. **Wrangler CLI** - Cloudflare Workers CLI tool
3. **Node.js 20+** - For development
4. **Git** - Already installed

---

## Step 1: Install Wrangler CLI

```bash
# Install wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

This will open a browser window to authenticate with Cloudflare.

---

## Step 2: Create Cloudflare D1 Databases

```bash
# Navigate to backend directory
cd backend

# Create production database
wrangler d1 create cgiworkflo-db-production

# Create development database
wrangler d1 create cgiworkflo-db-development

# Create staging database (optional)
wrangler d1 create cgiworkflo-db-staging
```

**Important:** Copy the `database_id` from each command's output and update `backend/wrangler.toml`:
- Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with production ID
- Replace `REPLACE_WITH_YOUR_DEV_D1_DATABASE_ID` with development ID

---

## Step 3: Create Cloudflare R2 Buckets

```bash
# Create production bucket for photos
wrangler r2 bucket create cgiworkflo-photos-production

# Create development bucket
wrangler r2 bucket create cgiworkflo-photos-development
```

R2 bucket names are automatically configured in `wrangler.toml`.

---

## Step 4: Create KV Namespace

```bash
# Create KV namespace for caching
wrangler kv:namespace create "CACHE"

# Create development KV namespace
wrangler kv:namespace create "CACHE" --preview
```

Update `wrangler.toml` with the KV namespace IDs.

---

## Step 5: Apply Database Schema

```bash
# Apply schema to development database (local)
wrangler d1 execute cgiworkflo-db-development --file=src/db/migrations/0001_initial_schema.sql --local

# Apply schema to production database (remote)
wrangler d1 execute cgiworkflo-db-production --file=src/db/migrations/0001_initial_schema.sql
```

This creates all tables, indexes, triggers, and seeds initial data (categories, materials).

---

## Step 6: Set JWT Secret

```bash
# Generate a secure random secret
openssl rand -base64 32

# Set as Cloudflare secret
wrangler secret put JWT_SECRET
# Paste the generated secret when prompted
```

---

## Step 7: Install Backend Dependencies

```bash
cd backend
npm install
```

---

## Step 8: Test Backend Locally

```bash
# Start development server with local D1
npm run dev

# In another terminal, test the API
curl http://localhost:8787/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-07T...",
  "environment": "development",
  "version": "v1"
}
```

---

## Step 9: Deploy Backend to Cloudflare Workers

```bash
# Deploy to production
npm run deploy:production

# Or deploy to staging first
npm run deploy:staging
```

After deployment, you'll get a URL like: `https://cgiworkflo-api.workers.dev`

---

## Step 10: Configure Cloudflare Pages (Frontend)

1. **Go to Cloudflare Dashboard** → Pages
2. **Connect to GitHub** - Select `cgiworkflo-monorepo` repository
3. **Configure build settings:**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: (leave empty or set to `frontend` when restructured)
   - Node version: `20`
4. **Set environment variables:**
   - `VITE_API_BASE_URL` = `https://cgiworkflo-api.workers.dev`
5. **Deploy**

---

## Step 11: Update _redirects File

After deploying the backend, update `_redirects` file with your actual Worker URL:

```
/api/* https://YOUR-WORKER-NAME.workers.dev/api/:splat 200
/* /index.html 200
```

---

## Local Development Workflow

### Run Frontend and Backend Together

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd /mnt/c/Users/Josh\ Klimek/Desktop/CGIWorkFlo.com
npm run dev
```

The frontend will proxy `/api/*` requests to the backend at `http://localhost:8787`.

### Database Operations

```bash
cd backend

# Apply migrations locally
npm run db:migrate:dev

# Seed test data
npm run db:seed

# Open D1 console (interactive SQL)
npm run db:console

# Open production console
npm run db:console:remote
```

---

## Monorepo Restructuring (Future)

When ready to properly structure as a monorepo:

1. **Rename current package.json:**
   ```bash
   mv package.json frontend/package.json
   mv package-root.json package.json
   ```

2. **Move all frontend files:**
   ```bash
   mkdir -p frontend
   mv src index.html vite.config.js tailwind.config.js postcss.config.js public frontend/
   ```

3. **Install workspace dependencies:**
   ```bash
   npm install
   npm install --workspace=frontend
   npm install --workspace=backend
   ```

4. **Update scripts:**
   - Use `npm run dev` to run both frontend and backend
   - Use `npm run dev:frontend` for frontend only
   - Use `npm run dev:backend` for backend only

---

## Environment Variables

### Backend (.env.local for local development)

```env
JWT_SECRET=your-super-secret-key
```

### Frontend (.env.development)

```env
VITE_API_BASE_URL=http://localhost:8787
```

### Frontend (.env.production)

```env
VITE_API_BASE_URL=https://cgiworkflo-api.workers.dev
```

---

## Next Steps

1. ✅ Basic backend structure created
2. ⏳ Implement authentication routes (`backend/src/routes/auth.ts`)
3. ⏳ Implement AAR routes (`backend/src/routes/aars.ts`)
4. ⏳ Implement auth middleware (`backend/src/middleware/auth.ts`)
5. ⏳ Create frontend API client (`src/lib/api-client.ts`)
6. ⏳ Refactor AuthContext to use API
7. ⏳ Refactor AARContext to use API
8. ⏳ Set up CI/CD with GitHub Actions
9. ⏳ Deploy to production

---

## Troubleshooting

### Wrangler login fails
```bash
# Try logging in with a browser
wrangler login

# Or use API token
export CLOUDFLARE_API_TOKEN=your-token
```

### D1 database not found
- Make sure you've created the database with `wrangler d1 create`
- Verify the `database_id` in `wrangler.toml` matches
- Check you're using the correct environment (--env flag)

### CORS errors in development
- Verify `CORS_ORIGINS` in `wrangler.toml` includes `http://localhost:3000`
- Check the frontend is running on port 3000
- Clear browser cache

### Build fails
```bash
# Clean and reinstall
cd backend
rm -rf node_modules package-lock.json
npm install
```

---

## Useful Commands

```bash
# Backend
cd backend
npm run dev              # Start local dev server
npm run build            # Build for production
npm run deploy           # Deploy to Cloudflare Workers
npm run db:migrate:dev   # Apply migrations locally
npm run type-check       # Check TypeScript types
wrangler tail            # View live logs

# Frontend
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build

# View D1 database
wrangler d1 execute cgiworkflo-db-development --command "SELECT * FROM users LIMIT 10" --local
```

---

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Hono Framework Docs](https://hono.dev/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Cloudflare documentation
3. Check the plan file: `~/.claude/plans/rippling-forging-chipmunk.md`

Ready to build! 🚀
