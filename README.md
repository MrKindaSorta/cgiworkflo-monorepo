# CGIWorkFlo.com

A mobile-first React application for managing After Action Reports (AARs) in the automotive repair industry.

## Features

- **Role-based Access Control**: Support for Admin, Manager, Franchisee, and Employee roles
- **AAR Management**: Submit, browse, and manage detailed repair documentation
- **Mobile-First Design**: Optimized for 50%+ mobile usage with touch-friendly UI
- **Internationalization**: Support for English, French, German, Spanish, and Japanese
- **Dark Mode**: Global light/dark theme support
- **Unit Conversion**: Automatic conversion between metric and imperial units
- **Photo Management**: Upload and manage before/after repair photos
- **Advanced Search**: Full-text search with filtering and sorting
- **Analytics Dashboard**: Comprehensive metrics for Admin/Manager roles
- **Responsive Navigation**: Desktop sidebar, mobile bottom navigation

## Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (mobile-first)
- **UI Components**: Headless UI, Radix UI
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Photo Upload**: React Dropzone
- **Routing**: React Router DOM
- **i18n**: react-i18next

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at http://localhost:3000/

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/        # Reusable components
│   ├── layout/       # Layout components (Sidebar, Header, etc.)
│   ├── ui/           # UI components (Language Selector, etc.)
│   ├── forms/        # Form components
│   ├── aar/          # AAR-specific components
│   ├── chat/         # Chat components
│   └── analytics/    # Analytics components
├── contexts/         # React Context providers
│   ├── AuthContext   # Authentication and user management
│   ├── ThemeContext  # Theme and branding management
│   └── AARContext    # AAR data management
├── pages/            # Page components
├── mocks/            # Mock data
├── utils/            # Utility functions
├── i18n/             # Internationalization
│   ├── config.js     # i18n configuration
│   └── locales/      # Translation files
├── hooks/            # Custom React hooks
└── assets/           # Static assets

```

## Authentication

The app uses a mock authentication system. On the login page:

1. Enter your name and email
2. Select a role (Admin, Manager, Franchisee, or Employee)
3. Enter your address
4. Click Login

User data is stored in localStorage for persistence.

## Role Permissions

- **Admin**: Full access to all features
- **Manager**: View/manage AARs, analytics, custom forms, branding (no user creation)
- **Franchisee**: Submit/view AARs, create employees
- **Employee**: Submit/view AARs only

## Data Persistence

All data is stored in localStorage, including:
- User profiles
- AARs (After Action Reports)
- Messages and conversations
- Notifications
- User preferences (theme, language, units)
- Branding settings

## Internationalization

The app supports 5 languages:
- English (en)
- French (fr)
- German (de)
- Spanish (es)
- Japanese (ja)

Change language using the language selector in the sidebar or login page.

## Unit Conversion

The app supports automatic unit conversion:
- **Area**: Square feet ↔ Square meters
- **Liquid**: ml, oz, liters, gallons

User preferences are saved and applied automatically when viewing AARs.

## Deployment

This app is designed to be deployed to Cloudflare Pages or any static hosting service.

### Cloudflare Pages

1. Build the project: `npm run build`
2. Deploy the `dist` folder to Cloudflare Pages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

ISC

## Support

For issues and questions, please open an issue on the repository.
