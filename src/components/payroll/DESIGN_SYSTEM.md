# Payroll Management Design System

This document outlines the design system and UI components used in the Payroll Management module (Soft Loan Management & Approval).

## Design Principles

1.  **Native App Feel**:
    - Smooth transitions and animations (`animate-in`, `slide-in`, `zoom-in`).
    - Glassmorphism effects (`backdrop-blur-xl`, `bg-white/95`) for sticky headers and overlays.
    - Large touch targets for mobile (min 44px).

2.  **Mobile-First Responsiveness**:
    - **Mobile**: Card-based layout, simplified information density, direct actions (swipe-like or prominent buttons).
    - **Desktop**: Table-based layout, rich data density, bulk actions.
    - **Adaptive Layout**: `md:hidden` / `hidden md:block` utilities to switch views completely.

3.  **Feedback & States**:
    - **Loading**: Skeleton loaders (`SkeletonRow`, `SkeletonCard`) instead of spinners for perceived performance.
    - **Interactive**: Hover effects (`group-hover`, `hover:shadow-md`, `scale`) on cards and buttons.
    - **Status**: Color-coded badges for clear status recognition.

## Core Components

### 1. StatCard
Used for displaying summary statistics at the top of dashboards.

**Props:**
- `title`: Label text (e.g., "Total Loans").
- `value`: Main numerical value.
- `icon`: Lucide icon component.
- `variant`: Color variant name (`indigo`, `emerald`, `blue`, `rose`, `amber`, `violet`).
- `trend`: Trend indicator (optional).

**Visual Style:**
- White background, rounded-2xl.
- Icon with colored background opacity based on variant.
- Hover effect: Shadow increase and icon scale.

### 2. StatusBadge
Unified status indicator across the module.

**Supported Statuses:**
- `PENDING` (Amber): Menunggu Review / Approval.
- `APPROVED` / `ACTIVE` (Emerald): Disetujui / Aktif.
- `REJECTED` / `CANCELLED` (Rose): Ditolak / Dibatalkan.
- `COMPLETED` (Blue): Lunas.

**Visual Style:**
- Pill shape (`rounded-full`).
- Light background with dark text and matching border/ring.
- Includes status icon.

### 3. Skeleton Loaders
Used during data fetching.

- **SkeletonRow**: Table row placeholder for desktop view.
- **SkeletonCard**: Card placeholder for mobile view.

### 4. Layout Structure
- **Container**: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8`.
- **Header**: Flex container with title on left, stats on right (stack on mobile).
- **Controls**: Sticky bar with Search and Filter Tabs.

## Typography & Colors
- **Font**: Inter (default Next.js font).
- **Primary Color**: Indigo (`indigo-600` for actions, `indigo-50` for backgrounds).
- **Success**: Emerald.
- **Danger**: Red/Rose.
- **Warning**: Amber.

## Implementation Guidelines
When adding new pages to this module:
1. Copy the `StatCard`, `StatusBadge`, and Skeleton definitions to keep the file self-contained (or import if refactored to `components/ui`).
2. Implement both Desktop (Table) and Mobile (Card) views using the responsive utility classes.
3. Ensure all async actions have loading states and error handling.
