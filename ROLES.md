# Role-Based Access Control (RBAC) - SETU PM Ajay

## Overview

SETU PM Ajay implements a hierarchical role-based access control system with three distinct user roles, each with specific permissions and data visibility.

## Role Hierarchy

```
ADMIN (Highest Permissions)
   ↓
MANAGER
   ↓
GROUND (Field Workers)
```

## Role Definitions

### 1. GROUND (Field Workers)
**Primary Users:** Field workers, surveyors, ground-level employees

**Platforms:** Mobile App

**Data Visibility:**
- ✅ Only gaps THEY submitted
- ❌ Cannot see gaps submitted by other users

**Permissions:**
- ✅ Create new gaps (via voice, image, or text)
- ✅ View their own submission history
- ✅ Search their own gaps
- ❌ Cannot change gap status
- ❌ Cannot access analytics dashboard

**Use Case:** Ground workers use the mobile app to report infrastructure gaps they encounter during field visits. They can only track their own submissions.

---

### 2. MANAGER
**Primary Users:** Team managers, supervisors, regional coordinators

**Platforms:** Web Dashboard

**Data Visibility:**
- ✅ See ALL gaps from ALL users
- ✅ Full system overview

**Permissions:**
- ✅ Create gaps
- ✅ Verify gaps submitted by ground workers
- ✅ Update gap status (open → in_progress)
- ✅ View analytics and reports
- ✅ Search and filter all gaps
- ❌ Cannot resolve gaps (mark as resolved)

**Use Case:** Managers oversee field operations, verify submitted gaps, track progress, and coordinate work assignments.

---

### 3. ADMIN (System Administrator)
**Primary Users:** System administrators, IT staff, senior officials

**Platforms:** Web Dashboard + Backend

**Data Visibility:**
- ✅ See ALL gaps from ALL users
- ✅ Full system access

**Permissions:**
- ✅ All permissions from MANAGER
- ✅ **Resolve gaps** (mark as resolved)
- ✅ User management (create, update, delete users)
- ✅ System configuration
- ✅ Access to backend admin panel (Django Admin)
- ✅ Database management
- ✅ Logs and audit trails

**Use Case:** Admins maintain the system, manage user accounts, resolve gaps, configure settings, and ensure system health.

---

## Technical Implementation

### Mobile App (React Native)
**File:** `mobile-app/src/context/AuthContext.js`

```javascript
// Role filtering in data queries
const loadGaps = async () => {
  // Ground workers: filter by submitted_by
  const filters = (userRole === 'ground' && user?.uid) 
    ? { submitted_by: user.uid } 
    : {}; // Managers/Admin: no filter
  
  const data = await gapsApi.getAll(filters);
};
```

---

### Frontend (Next.js)
**File:** `frontend/src/context/AuthContext.tsx`

```typescript
// Permission helpers
const canVerifyGaps = hasMinRole('manager');    // Manager+
const canManageGaps = hasMinRole('manager');    // Manager+
const canResolveGaps = hasMinRole('admin');     // Admin only
const canViewAnalytics = hasMinRole('manager'); // Manager+
```

---

## Access Control Matrix

| Feature | Ground | Manager | Admin |
|---------|--------|---------|-------|
| **Data Access** |
| View own gaps | ✅ | ✅ | ✅ |
| View all gaps | ❌ | ✅ | ✅ |
| **Gap Management** |
| Create gap | ✅ | ✅ | ✅ |
| Verify gap | ❌ | ✅ | ✅ |
| Update status | ❌ | ✅ | ✅ |
| Resolve gap | ❌ | ❌ | ✅ |
| **Analytics** |
| View dashboard | ❌ | ✅ | ✅ |
| Generate reports | ❌ | ✅ | ✅ |
| **Administration** |
| Manage users | ❌ | ❌ | ✅ |
| System config | ❌ | ❌ | ✅ |

---

## Default Test Users

```javascript
{
  email: "ground@setu.gov.in",
  password: "password123",
  role: "ground"
},
{
  email: "manager@setu.gov.in",
  password: "password123",
  role: "manager"
},
{
  email: "admin@setu.gov.in",
  password: "password123",
  role: "admin"
}
```

---

## Questions?

For implementation details, see:
- Mobile: `mobile-app/src/context/AuthContext.js`
- Frontend: `frontend/src/context/AuthContext.tsx`
- API: `frontend/src/lib/api.ts`
