# Prime Care Clinic Management System

## Overview

Prime Care Clinic Management System is a comprehensive healthcare management application designed for efficient clinic operations. The system handles patient registration, visit tracking, medicine inventory, treatment protocols, billing operations, expense management, and reporting. Built with a modern tech stack, it provides a productivity-focused interface tailored for healthcare professionals to manage day-to-day clinic operations with clarity and efficiency.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast hot module replacement
- Wouter for lightweight client-side routing

**UI Component System**
- shadcn/ui component library built on Radix UI primitives for accessible, unstyled components
- Tailwind CSS for utility-first styling with custom design tokens
- Design system follows healthcare productivity application principles emphasizing information density balanced with readability
- Custom theme provider supporting light/dark modes

**State Management & Data Fetching**
- TanStack Query (React Query) for server state management, caching, and synchronization
- React Hook Form with Zod resolver for form state and validation
- Custom hooks for mobile detection and toast notifications

**Design Tokens**
- Healthcare-focused color palette with teal primary color (HSL 174, 55%, 42%)
- Custom spacing scale using Tailwind's 2, 4, 6, 8 unit system
- Typography using Inter/Roboto with defined scale from text-xs to text-2xl
- Consistent border radius system (3px, 6px, 9px)

### Backend Architecture

**Server Framework**
- Express.js for HTTP server with TypeScript
- Custom logging middleware for request/response tracking
- JSON body parsing with raw body preservation for webhook support
- Static file serving for production builds

**API Design**
- RESTful API endpoints organized by resource (patients, visits, medicines, treatments, bills, expenses)
- Centralized route registration in `server/routes.ts`
- Zod schema validation for all incoming requests
- Consistent error handling with appropriate HTTP status codes

**Storage Layer**
- Abstract storage interface (`IStorage`) defining data operations
- In-memory storage implementation for development
- Designed for easy migration to persistent database (PostgreSQL prepared via Drizzle configuration)
- Type-safe operations using shared TypeScript interfaces

### Data Storage Solutions

**Schema Design**
- Patient records: ID, name, phone, registration date
- Visit records: Linked to patients with complaints, diagnosis, visit numbering
- Medicine inventory: Name, purchase cost, selling price, quantity tracking
- Treatment protocols: Name and cost
- Bills: Patient association, itemized medicine/treatment lists, payment tracking with partial payment support
- Expenses: Category-based tracking with date, amount, description

**Database Preparation**
- Drizzle ORM configured for PostgreSQL
- Schema definitions in `shared/schema.ts` using Zod for runtime validation
- Migration setup via drizzle-kit ready for database provisioning
- Connection to Neon serverless PostgreSQL via `@neondatabase/serverless`

**Data Validation**
- Shared Zod schemas between client and server ensure consistency
- Insert schemas for all entities with field-level validation rules
- Type inference from Zod schemas for TypeScript types

### Authentication and Authorization

**Current State**
- No authentication system currently implemented
- All endpoints publicly accessible
- Session management dependencies present (express-session, connect-pg-simple, passport) but not configured

**Planned Architecture**
- express-session with PostgreSQL session store for persistent sessions
- Passport.js with local strategy for username/password authentication
- Session-based authentication suitable for clinic staff access control

### External Dependencies

**Core Libraries**
- React ecosystem: react, react-dom, react-router (wouter)
- UI components: @radix-ui/* suite for accessible primitives
- Form handling: react-hook-form, @hookform/resolvers
- Data fetching: @tanstack/react-query
- Validation: zod, zod-validation-error, drizzle-zod
- Styling: tailwindcss, class-variance-authority, clsx, tailwind-merge

**Backend Services**
- Database: @neondatabase/serverless, drizzle-orm
- Server utilities: express, cors, express-rate-limit
- Session management: express-session, connect-pg-simple, memorystore
- Date utilities: date-fns

**Development Tools**
- Build: vite, esbuild, tsx
- Type checking: typescript
- Replit integration: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer

**Chart & Visualization**
- recharts for financial and inventory reporting visualizations

**Database & ORM**
- PostgreSQL via Neon serverless driver
- Drizzle ORM for type-safe database queries
- Drizzle Kit for schema migrations

**Font Loading**
- Google Fonts: DM Sans, Architects Daughter, Fira Code, Geist Mono (via CDN in index.html)