# System Metrics Dashboard - Visual Guide

## 🎨 What It Looks Like

### Overall Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  System Analytics                                               │
│  Monitor deployment status across all platforms                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ✓  System Status                         Total Services: 4    │
│     All Systems Operational               Healthy: 4           │
│                                           Issues: 0             │
│  ████████████████████████████████████████ 100%                 │
│  Last updated: 2m ago                     [↻ Refresh]          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────┐
│  Fly.io Deployments  [2 apps]│  │  Northflank Services  [2 svc]│
├──────────────────────────────┤  ├──────────────────────────────┤
│  ☁ barbara-voice-bridge      │  │  ⚙ api-service               │
│     Running ✓                │  │     Running ✓                │
│     🌍 barbara-voice-...     │  │     ❤ Health: healthy        │
│     📍 sjc                   │  │     📋 2 replicas            │
│     #️⃣ v42                   │  │     📍 us-east              │
│     🕐 2h ago                 │  │     🕐 1d ago                │
│                              │  │                              │
│  ☁ barbara-v3-voice          │  │  ⚙ worker-service            │
│     Running ✓                │  │     Running ✓                │
│     🌍 barbara-v3-voice...   │  │     ❤ Health: healthy        │
│     📍 sjc                   │  │     📋 1 replica             │
│     #️⃣ v28                   │  │     📍 us-east              │
│     🕐 5h ago                 │  │     🕐 2d ago                │
└──────────────────────────────┘  └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [Switch] Auto-refresh ON   Refreshing every 30s               │
└─────────────────────────────────────────────────────────────────┘
```

## 🎨 Color Scheme

### Status Indicators

**Healthy (Green)**
```
✓ All Systems Operational
████████████████████████████ 100%
```

**Degraded (Yellow)**
```
⚠ Partial Outage
████████████░░░░░░░░░░░░░░░░ 50%
```

**Critical (Red)**
```
✖ Major Outage
███░░░░░░░░░░░░░░░░░░░░░░░░░ 10%
```

### Service Status Badges

- 🟢 **Running** - Service is operational
- 🟡 **Warning** - Service has issues
- 🔴 **Error** - Service is down
- ⚪ **Unknown** - Status unclear

## 📱 Responsive Design

### Desktop (>1200px)
```
┌──────────────────────────────────────────────────┐
│                 Overall Health                    │
├───────────────────────┬──────────────────────────┤
│     Fly.io Apps      │    Northflank Services   │
│    (Full width)      │     (Full width)         │
└───────────────────────┴──────────────────────────┘
```

### Tablet (768px - 1200px)
```
┌──────────────────────────────┐
│      Overall Health          │
├──────────────────────────────┤
│       Fly.io Apps            │
├──────────────────────────────┤
│    Northflank Services       │
└──────────────────────────────┘
```

### Mobile (<768px)
```
┌────────────────┐
│ Overall Health │
├────────────────┤
│   Fly.io Apps  │
├────────────────┤
│ Northflank Svc │
└────────────────┘
```

## 🎯 Interactive Elements

### Clickable Elements
- **Hostnames**: Click to open app in new tab
- **Refresh Button**: Manually refresh metrics
- **Auto-refresh Switch**: Toggle auto-updates

### Hover Effects
- Service cards lift on hover
- Border color changes to primary
- Subtle shadow appears

### Loading States
```
┌─────────────────────────────┐
│         ⟳                   │
│  Loading system metrics...  │
│                             │
└─────────────────────────────┘
```

### Error States
```
┌─────────────────────────────┐
│  ⚠ Error Loading Metrics    │
│  HTTP 500: Server Error     │
│  [Try Again]                │
└─────────────────────────────┘
```

## 🔔 Configuration States

### Not Configured
```
┌──────────────────────────────────────┐
│  Northflank Services  [Not Configured]│
├──────────────────────────────────────┤
│  ⚠ Northflank monitoring not config  │
│     NORTHFLANK_API_TOKEN not set     │
└──────────────────────────────────────┘
```

### Partially Configured
```
Overall Status: Degraded (50%)

✓ Fly.io: 2 apps running
⚠ Northflank: Not configured
```

### Fully Configured
```
Overall Status: Healthy (100%)

✓ Fly.io: 2 apps running
✓ Northflank: 2 services running
```

## 🎨 Theme Support

The dashboard automatically adapts to your portal's theme:

### Light Mode
- White/light gray cards
- Dark text
- Colored status indicators

### Dark Mode
- Dark cards
- Light text
- Bright status indicators

## 📊 Real-World Examples

### Example 1: Everything Healthy
```
System Status: All Systems Operational (100%)
Total: 4 services | Healthy: 4 | Issues: 0

Fly.io (2 apps)
  ✓ barbara-voice-bridge - Running - sjc - v42
  ✓ barbara-v3-voice - Running - sjc - v28

Northflank (2 services)
  ✓ api-service - Running - 2 replicas
  ✓ worker-service - Running - 1 replica
```

### Example 2: One Service Down
```
System Status: Partial Outage (75%)
Total: 4 services | Healthy: 3 | Issues: 1

Fly.io (2 apps)
  ✓ barbara-voice-bridge - Running - sjc - v42
  ✗ barbara-v3-voice - Error: Failed health check

Northflank (2 services)
  ✓ api-service - Running - 2 replicas
  ✓ worker-service - Running - 1 replica
```

### Example 3: Not Configured
```
System Status: Unknown (0%)
Total: 0 services

Fly.io
  ⚠ Not configured - FLY_API_TOKEN not set

Northflank
  ⚠ Not configured - NORTHFLANK_API_TOKEN not set
```

## 🎬 User Flow

1. **Visit Dashboard**
   - Loading spinner appears
   - "Loading system metrics..." shown

2. **Data Loads**
   - Overall health card animates in
   - Platform cards populate
   - Status indicators update

3. **Interact**
   - Hover over services (card lifts)
   - Click hostnames (opens in new tab)
   - Toggle auto-refresh (starts/stops timer)
   - Click refresh button (reloads data)

4. **Auto-Refresh**
   - Every 30 seconds
   - Updates in background
   - No page reload
   - Smooth transitions

## 💡 Visual Tips

### Good Status
- **Green gradient** on overall health card
- **Green badges** on all services
- **100% progress bar**

### Needs Attention
- **Orange/yellow** indicators
- **Warning badges**
- **< 100% progress bar**

### Critical Issues
- **Red indicators**
- **Error badges**
- **< 50% progress bar**

## 🖼️ Component Anatomy

### Service Card Structure
```
┌────────────────────────────────┐
│ Icon  Service Name    [Badge]  │ ← Header
├────────────────────────────────┤
│ 🌍 Hostname/URL               │ ← Details
│ 📍 Region                     │   (Grid)
│ #️⃣ Version                    │
│ 🕐 Last deployed              │
└────────────────────────────────┘
```

### Overall Health Card
```
┌────────────────────────────────┐
│ Status Icon  Status Text       │
│                                │
│ Stats: Total | Healthy | Issues│
│                                │
│ ████████████████████ Progress  │
│                                │
│ Last updated | Refresh Button  │
└────────────────────────────────┘
```

---

## 🎨 Design Philosophy

- **Clean**: Minimal clutter, essential info only
- **Clear**: Status immediately visible
- **Actionable**: Click hostnames, refresh on demand
- **Responsive**: Works on all devices
- **Accessible**: Proper contrast, clear labels
- **Modern**: Gradient cards, smooth animations

Enjoy your beautiful new dashboard! 🎉

