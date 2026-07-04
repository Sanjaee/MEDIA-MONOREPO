# ARCHITECTURE.md

# Project Overview

This project is a production-ready social media starter template built with:

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* shadcn/ui
* Golang (Gin REST API)
* PostgreSQL
* Redis
* Asynq
* NextAuth.js (Auth.js)
* TanStack Query
* TanStack Virtual
* React Hook Form
* Zod
* Zustand
* Docker
* Nginx
* Cloudflare

## Goals

* Lightweight and maintainable.
* Production-ready architecture.
* Server-first frontend.
* Clear separation between frontend and backend.
* Minimal client-side JavaScript.
* AI-agent friendly folder structure.
* Avoid unnecessary dependencies and duplicated logic.
* Follow modern Next.js App Router best practices.
* Keep the frontend thin and the backend authoritative.

---

# Core Principles

## 1. Server First

Prefer React Server Components (RSC).

Only use `"use client"` when one of these is required:

* useState
* useEffect
* browser APIs
* event handlers
* Zustand
* TanStack Query hooks
* React Hook Form

Never add `"use client"` to a page or layout unless absolutely necessary.

Server Components should fetch data through the Service Layer that communicates with the Golang Backend.

---

## 2. Data Ownership

### Server State → TanStack Query

Use TanStack Query for:

* Feed
* Posts
* Comments
* User profiles
* Notifications
* Followers
* Search results
* Bookmarks

Never duplicate server state into Zustand.

Server state always originates from the Golang Backend.

### Client/UI State → Zustand

Use Zustand only for:

* Theme
* Sidebar open/close
* Mobile menu
* Modal/dialog visibility
* Draft post content
* Upload preview
* Command palette
* Local UI filters
* Global loading overlay
* Global search dialog
* UI preferences

Never store API data collections in Zustand.

---

## 3. Backend Layer

The Golang Backend is the single source of truth.

Responsibilities:

* Business logic
* Authentication
* Authorization
* PostgreSQL access
* Redis caching
* Background jobs
* File uploads
* Notifications
* Feed generation

Next.js must never access PostgreSQL or Redis directly.

Communication between frontend and backend must happen through REST APIs.

---

## 4. API Layer

All HTTP communication must go through the Service Layer.

Structure:

```text
React Component
        ↓
TanStack Query
        ↓
Service Layer
        ↓
Golang REST API
```

Never call `fetch()` directly inside React components.

Place reusable API functions inside:

```text
src/
└── services/
    ├── auth.service.ts
    ├── post.service.ts
    ├── comment.service.ts
    ├── profile.service.ts
    ├── notification.service.ts
    └── user.service.ts
```

---

## 5. Authentication

### Authentication Stack

* NextAuth.js (Auth.js)
* Golang Authentication API

### Rules

* Use NextAuth.js for frontend session management.
* Authentication and authorization logic belong to the Golang Backend.
* Never implement database authentication inside Next.js.
* Never store tokens inside localStorage.
* Protect pages using middleware and authenticated sessions.
* Authentication logic must not be duplicated.

Suggested structure:

```text
src/
├── auth.ts
├── middleware.ts
└── app/
    └── api/
        └── auth/
```

---

## 6. Form Handling

Always use:

* React Hook Form
* Zod
* @hookform/resolvers

Validation rules:

* Client validation uses Zod.
* Server validation belongs to the Golang Backend.
* Never duplicate validation logic unnecessarily.

---

## 7. UI Components

Use shadcn/ui as the design system.

Rules:

* Prefer composition over modification.
* Keep reusable wrappers inside `/src/components`.
* Do not install large UI frameworks.
* Use Lucide React for icons.

Structure:

```text
src/components/
├── ui/
├── layout/
├── shared/
├── feed/
├── profile/
├── comment/
└── common/
```

---

## 8. Folder Structure

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── (feed)/
│   ├── profile/
│   ├── settings/
│   └── api/
│
├── components/
├── hooks/
├── lib/
├── providers/
├── services/
├── stores/
├── types/
├── utils/
├── middleware.ts
└── auth.ts
```

---

## 9. Zustand Store Rules

Store location:

```text
src/stores/
├── theme-store.ts
├── sidebar-store.ts
├── compose-store.ts
├── draft-store.ts
└── upload-store.ts
```

Allowed use cases:

* Theme
* Sidebar
* Mobile navigation
* Modal state
* Draft post
* Upload preview
* UI preferences

Never create:

* feed-store
* posts-store
* comments-store
* users-store
* notifications-store

These belong to TanStack Query.

---

## 10. TanStack Query Rules

Query Keys:

```ts
["feed"]
["feed", cursor]
["post", postId]
["comments", postId]
["profile", username]
["notifications"]
["bookmarks"]
```

Always use:

* useQuery
* useInfiniteQuery
* useMutation
* queryClient.invalidateQueries()

Prefer optimistic updates for:

* Like
* Bookmark
* Follow
* Delete own post

---

## 11. Feed Rendering

Large lists must use:

* TanStack Virtual
* useInfiniteQuery
* IntersectionObserver

Never render thousands of DOM nodes directly.

Feed flow:

```text
PostgreSQL
      ↓
Golang API
      ↓
TanStack Query
(useInfiniteQuery)
      ↓
TanStack Virtual
      ↓
React Component
```

---

## 12. File Uploads

Upload flow:

```text
Client
    ↓
Next.js
    ↓
Golang API
    ↓
Object Storage
    ↓
PostgreSQL Metadata
```

Never store uploaded files inside the repository.

Database stores only metadata and file URLs.

---

## 13. Styling

Use:

* Tailwind CSS
* shadcn/ui
* clsx
* tailwind-merge

Avoid:

* CSS-in-JS libraries.
* Large UI frameworks.
* Inline style objects except for dynamic values.

---

## 14. Performance Rules

* Prefer Server Components.
* Lazy load heavy client components.
* Use `next/image`.
* Use dynamic imports.
* Memoize expensive computations.
* Avoid unnecessary `useEffect`.
* Avoid unnecessary global state.
* Use TanStack Virtual for large lists.
* Prefer cursor pagination.
* Cache through Redis on the backend.
* Compress responses using Nginx.

---

## 15. AI Agent Coding Rules

When generating code, always follow these rules:

1. Prefer Server Components.
2. Do not add `"use client"` unless required.
3. Never access PostgreSQL directly from Next.js.
4. Never access Redis directly from Next.js.
5. All business logic belongs to the Golang Backend.
6. All API calls must go through `src/services`.
7. Use TanStack Query for server state.
8. Use Zustand only for UI state.
9. Use React Hook Form + Zod for forms.
10. Use shadcn/ui whenever possible.
11. Follow the existing folder structure.
12. Never create duplicate utility functions.
13. Never introduce Redux.
14. Never introduce Prisma or Drizzle unless explicitly requested.
15. Never add dependencies without a clear reason.
16. Keep bundle size small.
17. Prefer reusable components.
18. Prefer cursor pagination.
19. Read this ARCHITECTURE.md before generating code.

---

## 16. Dependency Policy

### Approved Runtime Dependencies

* next
* react
* react-dom
* next-auth
* @tanstack/react-query
* @tanstack/react-virtual
* react-hook-form
* zod
* @hookform/resolvers
* zustand
* date-fns
* lucide-react
* clsx
* tailwind-merge

### Approved Development Dependencies

* typescript
* eslint
* prettier

Avoid adding new libraries if existing dependencies or browser APIs already solve the problem.

---

## 17. Architecture Diagram

```text
                      Internet
                          │
                    Cloudflare (WAF)
                          │
                     Nginx Reverse Proxy
                   ┌────────┴────────┐
                   │                 │
                   ▼                 ▼
          Next.js Frontend      Golang API (Gin)
                   │                 │
                   │                 ├──────────────┐
                   │                 │              │
                   ▼                 ▼              ▼
         TanStack Query        PostgreSQL        Redis
         Zustand (UI Only)                         │
                                                   ▼
                                              Asynq Worker
```

---

## 18. Golden Rules

* **Server data belongs to TanStack Query.**
* **UI state belongs to Zustand.**
* **Business logic belongs to the Golang Backend.**
* **Database access belongs to the Golang Backend.**
* **Redis access belongs to the Golang Backend.**
* **Background jobs belong to Asynq.**
* **Frontend communicates only through the Service Layer.**
* **Presentation belongs to React Components.**
* **Never duplicate responsibilities between layers.**
* **Keep the project lightweight, secure, production-ready, and AI-agent friendly.**

