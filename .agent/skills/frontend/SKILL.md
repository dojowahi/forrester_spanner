---
name: Frontend UI Generation
description: Guidelines and context for generating frontend UI components matching the project's React, Tailwind v4, and Google Branding stack.
---

# Frontend UI Generation Skill

When asked to generate or modify frontend UI code, follow these guidelines to ensure consistency with the existing application architecture and design system.

## Stack & Libraries
- **Framework:** React 19 with Vite.
- **Language:** TypeScript. Always use strict typing and define interfaces for component props.
- **Styling:** Tailwind CSS v4.
- **Icons:** `lucide-react`. Use these consistently for all UI icons.
- **Data Visualization:** `recharts`.
- **Maps:** `@vis.gl/react-google-maps`.

## Design System & Theming (Google Branding)
The application uses a custom Google-inspired theme. Always prefer these custom colors over default Tailwind colors:

- **Primary Colors:** `google-blue`, `google-red`, `google-yellow`, `google-green`
- **Neutrals / Grays:** `google-gray-50` (backgrounds), `google-gray-100` (surface variants), `google-gray-800` (secondary text/borders), `google-gray-900` (primary text)

**Base Styling:**
The application background is typically `bg-google-gray-50` and default text is `text-google-gray-900`. The font is `font-sans` with `antialiased` rendering.

## Component Design Patterns

### 1. Cards and Containers
- Use white backgrounds for content containers: `bg-white`
- Apply subtle borders and shadows: `border border-google-gray-200 shadow-sm rounded-xl`
- Add hover effects for interactive cards: `hover:shadow-md transition-shadow`

### 2. Typography
- **Headers:** Use `font-semibold` or `font-medium` with `tracking-tight`. e.g., `text-lg font-semibold text-google-gray-900 tracking-tight`.
- **Subtitles/Labels:** Use small, uppercase text with wide tracking for section headers. e.g., `text-[10px] text-google-gray-800 uppercase tracking-widest font-semibold`.
- **Secondary Text:** Use `text-xs` or `text-sm` with `text-google-gray-800`.

### 3. Buttons & Actions
- **Primary Buttons (Blue):** `bg-google-blue text-white hover:bg-blue-600 transition-colors rounded-full font-medium shadow-sm flex items-center gap-2`
- **Secondary/Outline Buttons:** `border border-google-gray-200 text-google-gray-800 hover:bg-google-gray-50 transition-colors rounded-full font-medium flex items-center gap-2`
- **Icon Buttons:** Always include a text label alongside the icon for clarity, rather than relying solely on icons (e.g. `<HelpCircle className="w-4 h-4" /> About` instead of just the icon).
- **Action/Status Badges (Translucent):** Use a 10% opacity background with the corresponding text/border color.
  - Example (Green Action): `bg-google-green/10 text-google-green border border-google-green/30 px-3 py-1.5 rounded-full text-xs font-medium`

### 4. Layouts
- Prefer `flex` or `grid` for structuring components.
- Use `gap-2`, `gap-4`, or `gap-6` for consistent spacing between elements.
- For main page layouts, a common pattern is a sticky top header with a split-pane main content area (`flex-1 flex flex-col lg:flex-row`).

## Workflow Rules
1. **Component Location:** Place new components in `src/components/`.
2. **Icons:** Always import from `lucide-react`. Do not use SVGs directly unless it's a very specific custom asset.
3. **Favicons and Branding:** 
   - Never use the default `vite.svg` or default Vite/React logos. Always replace them to match the project's branding.
   - When updating app icons, prefer using `data:image/svg+xml` with emoji or simple vector content in `index.html` rather than adding `.svg` files to the `public/` directory to reduce bloat.
4. **Responsiveness:** Build mobile-first. Use `lg:` or `md:` prefixes for larger screens (e.g., `flex-col lg:flex-row`).
5. **State Management:** Keep state close to where it's needed using React hooks (`useState`, `useEffect`).
6. **Clean Code:** Remove unused imports and prefer concise, readable functional components.
