# Style Guide

## Design Philosophy

Kratzbaum's design aims to feel **natural, calm, and organized** — reflecting the peaceful nature of plant care. The interface should be clean and uncluttered, allowing plant photos to be the visual focus.

---

## Typography

### Font Families
Using Google Fonts loaded via `<link>` or `@fontsource`:

| Usage | Font | Weight |
|-------|------|--------|
| **Headers** | Roboto | 500, 700 |
| **Body Text** | Open Sans | 400, 600 |

---

## Color Palette

### Skeleton UI Theme (Tailwind)

```css
/* tailwind.config.js - extend colors */
colors: {
  primary: {
    50: '#f0fdf4',
    500: '#4CAF50',  /* Leaf Green */
    600: '#2D5A27',  /* Forest Green */
    700: '#1a3d17',
  },
  accent: {
    500: '#795548',  /* Earth Brown */
  },
  surface: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e0e0e0',
  }
}
```

### Semantic Colors

| Name | Tailwind Class | Usage |
|------|----------------|-------|
| Water | `text-sky-500` | Watering actions |
| Fertilize | `text-amber-500` | Fertilizing actions |
| Success | `text-green-500` | Confirmations |
| Warning | `text-amber-500` | Overdue reminders |
| Error | `text-red-500` | Errors |

---

## Skeleton UI Components

### Recommended Components

| Component | Usage |
|-----------|-------|
| `AppBar` | Top navigation |
| `AppRail` | Side navigation (desktop) |
| `Card` | Plant/pot cards |
| `Modal` | Dialogs, confirmations |
| `Toast` | Notifications |
| `Avatar` | Plant thumbnails |
| `Chip` | Status badges |
| `FileButton` | Photo upload |

### Example Plant Card

```svelte
<script>
  import { Card } from '@skeletonlabs/skeleton';
  import { Droplet, Leaf } from 'lucide-svelte';
  
  export let plant;
</script>

<Card class="overflow-hidden">
  <header>
    <img 
      src={plant.primaryPhoto} 
      alt={plant.name}
      class="aspect-square object-cover w-full"
    />
  </header>
  
  <section class="p-4">
    <h3 class="font-semibold text-lg">{plant.name}</h3>
    <p class="text-sm text-surface-600">{plant.species}</p>
  </section>
  
  <footer class="p-4 pt-0 flex gap-2">
    <button class="btn variant-soft-primary btn-sm">
      <Droplet class="w-4 h-4" />
      <span>Water</span>
    </button>
    <button class="btn variant-soft-secondary btn-sm">
      <Leaf class="w-4 h-4" />
      <span>Fertilize</span>
    </button>
  </footer>
</Card>
```

---

## Icons (Lucide Svelte)

```bash
npm install lucide-svelte
```

| Action | Icon | Import |
|--------|------|--------|
| Water | 💧 | `Droplet` |
| Fertilize | 🌿 | `Leaf` |
| Repot | 🪴 | `Flower2` |
| Add | ➕ | `Plus` |
| Camera | 📷 | `Camera` |
| Identify | 🔍 | `Search` |
| Settings | ⚙️ | `Settings` |
| Delete | 🗑️ | `Trash2` |

---

## Responsive Layout

### Tailwind Breakpoints

| Prefix | Min Width |
|--------|-----------|
| (none) | Mobile-first |
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |

### Grid Pattern

```svelte
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
  {#each plants as plant}
    <PlantCard {plant} />
  {/each}
</div>
```

---

## PWA Considerations

- **Touch targets**: Minimum 44x44px (`h-11 w-11`)
- **App icon**: 512x512 PNG
- **Theme color**: `#2D5A27` (Forest Green)
- **Safe areas**: Use `env(safe-area-inset-bottom)` for iPhone notch
