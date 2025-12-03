# Prime Care Clinic Management System - Design Guidelines

## Design Approach

**Selected Approach**: Design System-Based (Healthcare Productivity Application)

This is a utility-focused healthcare management system where efficiency, clarity, and data accuracy are paramount. Design inspiration drawn from modern medical software interfaces (Epic MyChart, Athenahealth) with Material Design principles for clean, professional aesthetics.

**Core Principle**: Information density balanced with breathing room. Medical data must be scannable while maintaining professional credibility.

---

## Typography System

**Font Family**: 
- Primary: Inter or Roboto (Google Fonts)
- Fallback: System UI fonts

**Type Scale**:
- Page Headers: text-2xl (24px) font-semibold
- Section Headers: text-lg (18px) font-medium  
- Form Labels: text-sm (14px) font-medium uppercase tracking-wide
- Body Text: text-base (16px) font-normal
- Table Data: text-sm (14px) font-normal
- Small Text/Meta: text-xs (12px) font-normal

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-4, p-6
- Section spacing: mb-6, mb-8
- Form field gaps: gap-4, gap-6
- Table cell padding: px-4 py-3

**Grid Structure**:
- Container: max-w-7xl mx-auto px-4
- Two-column forms: grid-cols-1 md:grid-cols-2 gap-6
- Dashboard cards: grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4

**Navigation**: 
- Horizontal navbar: Fixed top, full-width, h-16
- Logo left, navigation items center/right
- Consistent nav item spacing: px-4

---

## Component Library

### Forms & Data Entry
**Input Fields**:
- Standard height: h-10
- Border: border rounded-md
- Padding: px-3
- Focus state: ring-2 ring-offset-1
- Labels always above inputs with mb-2

**Form Layout Pattern**:
```
Form sections in cards with subtle borders
Field grouping with grid layouts
Required field indicators (asterisk)
Inline validation messages below fields
Action buttons right-aligned at bottom
```

**Search Bars**:
- Prominent placement with icon prefix
- Width: w-full md:w-96
- Debounced search (not in code, design consideration)

### Data Display

**Tables**:
- Striped rows for readability
- Sticky headers for long lists
- Row hover states for interactivity
- Action buttons/icons right-aligned in rows
- Responsive: Stack on mobile, horizontal scroll on tablet

**Cards** (Patient/Medicine/Treatment):
- Border: border rounded-lg
- Padding: p-6
- Shadow: shadow-sm
- Clickable cards: Cursor pointer with subtle hover lift
- Status badges in top-right corner

**Dashboard Layout**:
- Stats cards across top: 3-4 columns showing key metrics
- Patient list below with search
- Each patient row expandable/clickable for history

### Navigation & Actions

**Primary Buttons**:
- Height: h-10 px-6
- Rounded: rounded-md
- Font: text-sm font-medium

**Secondary Buttons**: 
- Outlined variant with border-2

**Icon Buttons** (Add/Edit/Delete):
- Size: w-8 h-8
- Icons: Use Heroicons (outline style)
- Tooltip on hover (aria-label)

**Plus Button** (Add Medicine):
- Circular: w-10 h-10 rounded-full
- Positioned at end of medicine row

### Billing & Financial Components

**Billing Form Structure**:
- Patient selector dropdown at top (searchable)
- Patient details card (read-only, clean display)
- Treatment section: Dropdown + amount field side-by-side
- Medicine section: Repeatable rows with medicine dropdown + editable price + quantity
- Total calculation card: Subtotal, treatments, medicines, grand total
- Payment section: Amount given field + pending balance display (prominent if >0)

**Bill History Table**:
- Columns: Date, Patient, Treatments, Medicines, Total, Paid, Balance, Actions
- Pending payments highlighted
- Click row to view/edit

### Visit History Display

**Timeline Layout**:
- Reverse chronological (latest first)
- Each visit as card with date header
- Visit number badge (1st Visit, 2nd Visit, etc.)
- Expandable sections for Complaints, Diagnosis, Prescription, Treatment
- Separator lines between visits

### Master Data Screens

**Medicine Master**:
- Table with columns: Name, Purchase Cost, Selling Price, Stock Qty, Actions
- Add new medicine form in modal/sidebar
- Stock indicator (low stock warning)

**Treatment Master**:
- Simple list with treatment name + actions
- Inline editing

---

## Specialized Healthcare Patterns

**Patient Identification**: 
- Patient name + phone always paired
- Date formatting: DD MMM YYYY (01 Dec 2024)

**Status Indicators**:
- Pending payments: Badge with amount
- Low stock: Warning indicator
- Visit recency: "Last visit: X days ago"

**Multi-Medicine Entry**:
- Row-based entry with + button
- Each row: Medicine dropdown (searchable) | Editable price field | Quantity spinner | Remove icon

---

## Accessibility & Usability

- Form fields: Proper label association, placeholder text
- Tables: Header scope attributes
- Interactive elements: Minimum 44x44px touch target
- Focus indicators: Clear ring on all interactive elements
- Error states: Red border + error message below field
- Success states: Green checkmark icons

---

## Professional Medical Aesthetic

**Visual Tone**: Clean, trustworthy, clinical but approachable

**Whitespace Strategy**: 
- Generous padding in cards and forms (p-6, p-8)
- Breathing room between sections
- Not cramped, but information-dense where needed

**Visual Hierarchy**:
- Page title → Section cards → Form fields
- Use subtle shadows and borders, not heavy visual treatments
- Consistent card elevations throughout

**No Images Required**: This is a data-driven application - no hero images or decorative photography needed

**Animations**: Minimal - only subtle transitions on hovers and state changes (150-200ms duration)