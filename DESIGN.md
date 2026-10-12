# Video Cut App Design System

## 1. Atmosphere & Identity

A compact, practical editing workspace. Dense controls stay grouped in quiet slate surfaces; emerald marks editing actions and sky blue marks Drive/export actions. Preserve the existing interface rather than introducing a new visual language.

## 2. Color

| Role | Existing token | Usage |
| --- | --- | --- |
| Main text | `text-slate-800` / `text-slate-200` | Light / dark mode |
| Muted text | `text-slate-400` | Hints and labels |
| Surface | `bg-white` / `bg-slate-900` | Light / dark cards |
| Nested surface | `bg-slate-50` / `bg-slate-800` | Inputs and secondary areas |
| Border | `border-slate-200` / `border-slate-700` | Controls and cards |
| Drive action | `sky-600` | Drive/export controls and guidance |
| Editing action | `emerald-600` | Segment controls |

Use the paired light/dark classes already present in the component being changed.

## 3. Typography

Use the system sans-serif stack. Existing utility scale: `text-xs` for controls, `text-[10px]` for compact labels, `text-sm` for section titles. Keep help copy at `text-xs` or larger where possible.

## 4. Spacing & Layout

Use the existing Tailwind spacing scale in 4px increments. Admin settings are vertically scrollable cards with responsive CSS grid fields (`md:grid-cols-*`); allow fields and instructions to stack on narrow screens.

## 5. Components

### Admin settings card
- Structure: bordered section, title/description, grouped controls, save action.
- Variants: light and dark.
- States: default, disabled while saving, validation/error through adjacent status copy.
- Accessibility: visible labels; native buttons and inputs remain keyboard accessible.

### Settings field
- Structure: label above native input.
- Variants: text, number, path/ID.
- States: default, focus, disabled.
- Accessibility: label is associated with its input; preserve native focus indication.

## 6. Motion & Interaction

Follow existing transitions. No new motion is needed for static setup instructions. Save feedback appears next to the existing save control.

## 7. Depth & Surface

Use the existing mixed treatment: subtle borders separate cards and controls; reserve shadows for dialogs and overlays. Card radius follows the nearby `rounded-lg` pattern.

## 8. Accessibility Constraints & Accepted Debt

Target keyboard-operable controls, readable light/dark contrast, and one-column reflow on narrow screens. Existing compact labels below 12px are accepted legacy density in the editor; do not shrink newly added instructional copy to that scale.
