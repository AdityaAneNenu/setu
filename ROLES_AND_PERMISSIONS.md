# Role-Based Access Control (RBAC) - PM-AJAY System

## Overview
The PM-AJAY gap management system implements a 4-tier role-based access control system designed for government operations in Andhra Pradesh. This ensures proper authorization, accountability, and audit trails for all gap management activities.

---

## Role Hierarchy

### 1. GROUND (Field Reporter / Postman)
**Purpose:** Data collection and initial reporting from the field

**Permissions:**
- ✅ Create new gaps (voice/image/text)
- ✅ View gaps in their area
- ✅ Upload supporting evidence
- ❌ Cannot verify gaps
- ❌ Cannot mark as "In Progress"
- ❌ Cannot mark as "Resolved"

**Use Case:** Field workers who collect ground-level information and report issues to supervisors.

---

### 2. MANAGER (Block Supervisor / Section Officer)
**Purpose:** First-level verification and operational coordination

**Permissions:**
- ✅ All GROUND permissions
- ✅ Verify reported gaps
- ✅ Change status: `open → in_progress`
- ✅ Assign tasks and coordinate work
- ✅ Add notes and follow-ups
- ❌ Cannot mark as "Resolved"

**Use Case:** Block-level supervisors who validate reported gaps and coordinate implementation work.

**Why Cannot Resolve:** Resolution requires official closure authority and documented proof, which should only be done by senior officers.

---

### 3. AUTHORITY (District Officer / Competent Authority)
**Purpose:** Official closure and accountability

**Permissions:**
- ✅ All MANAGER permissions
- ✅ Mark gaps as "Resolved"
- ✅ Upload resolution proof (mandatory)
- ✅ Re-open incorrectly closed gaps
- ✅ Final approval/sign-off
- ❌ Cannot manage system users

**Use Case:** District-level officers with authority to officially close cases after verifying completion.

**Resolution Requirements:**
1. **Resolution Proof Document** (letter/certificate) must be uploaded
2. **Resolution Reference Number** must be provided
3. **Voice Verification** (for voice-submitted gaps) must pass
4. System records: `resolved_by` username and `resolved_at` timestamp

---

### 4. ADMIN (System Administrator)
**Purpose:** System management and emergency overrides

**Permissions:**
- ✅ All AUTHORITY permissions
- ✅ Manage user accounts and roles
- ✅ View all data across all districts
- ✅ System configuration
- ✅ Backup and maintenance
- ✅ Emergency overrides

**Use Case:** IT administrators and system owners who maintain the platform.

**Best Practice:** Admin should not be used for day-to-day gap management. Use appropriate role (GROUND/MANAGER/AUTHORITY) for operational work.

---

## Permission Matrix

| Action | GROUND | MANAGER | AUTHORITY | ADMIN |
|--------|--------|---------|-----------|-------|
| Create Gap | ✅ | ✅ | ✅ | ✅ |
| View Gaps | ✅ | ✅ | ✅ | ✅ |
| Verify Gap | ❌ | ✅ | ✅ | ✅ |
| Status: Open → In Progress | ❌ | ✅ | ✅ | ✅ |
| Status: → Resolved | ❌ | ❌ | ✅ | ✅ |
| Upload Resolution Proof | ❌ | ❌ | ✅ | ✅ |
| Re-open Resolved Gap | ❌ | ❌ | ✅ | ✅ |
| Manage Users/Roles | ❌ | ❌ | ❌ | ✅ |
| System Configuration | ❌ | ❌ | ❌ | ✅ |

---

## Resolution Workflow (Government Standard)

### For Regular Gaps (Image/Text)
1. GROUND creates gap → Status: `open`
2. MANAGER verifies → Status: `in_progress`
3. Work completed
4. AUTHORITY reviews completion
5. AUTHORITY uploads **resolution proof letter** + reference number
6. AUTHORITY marks as `resolved`

### For Voice Gaps (Audio Complaints)
1. GROUND records voice complaint → Status: `open`
2. MANAGER verifies → Status: `in_progress`
3. Work completed
4. AUTHORITY reviews completion
5. AUTHORITY uploads **resolution proof letter** + reference number
6. AUTHORITY performs **voice verification** (biometric match)
7. If voice matches original complainant → AUTHORITY marks as `resolved`
8. If voice doesn't match → Resolution blocked (prevents fraud)

---

## Resolution Proof Requirements

### What is Resolution Proof?
Official documentation proving that the gap has been resolved, typically:
- Completion certificate
- Work completion letter from issuing authority
- Inspection report with official seal
- Before/after photographs with official endorsement

### Required Fields:
1. **Document Upload:** PDF, JPG, or PNG (max 10MB)
2. **Reference Number:** Official reference/file number (e.g., `RES/2026/001`)

### Why Mandatory?
- Government accountability and audit trails
- Legal defensibility of closure decisions
- Prevents premature or unauthorized closures
- Satisfies RTI (Right to Information) requirements

---

## Security Features

### Audit Trail
Every resolution is tracked with:
- `resolved_by`: Username of the officer who closed the gap
- `resolved_at`: Exact timestamp of closure
- `resolution_proof`: Uploaded document
- `resolution_proof_number`: Reference number

### Voice Biometric Verification
For voice-submitted gaps:
- Original complainant's voice is recorded and analyzed
- Closure requires voice verification by the SAME person
- Prevents fraudulent closures by unauthorized individuals
- Uses voice fingerprint matching (pitch, tone, timbre)

---

## How to Assign Roles

### Via Django Admin (for ADMIN users):
1. Login to admin panel: `http://your-domain/admin/`
2. Navigate to: **Core** → **User Profiles**
3. Click on the user to edit
4. Select appropriate role from dropdown:
   - Ground Level
   - Manager
   - Highest Authority (AUTHORITY)
   - Admin
5. Save

### Via Code (for developers):
```python
from django.contrib.auth.models import User
from core.models import UserProfile

# Create user
user = User.objects.create_user(username='officer1', password='secure_password')

# Assign role
profile, created = UserProfile.objects.get_or_create(user=user)
profile.role = 'authority'  # or 'ground', 'manager', 'admin'
profile.save()
```

---

## Best Practices

### For GROUND Users:
- Report gaps accurately with clear descriptions
- Upload supporting photos/audio
- Provide location information when possible

### For MANAGER Users:
- Verify gaps promptly to prevent backlog
- Add detailed notes for context
- Coordinate with field teams for implementation

### For AUTHORITY Users:
- Only mark as resolved when work is truly complete
- Always upload resolution proof documents
- Provide clear reference numbers
- For voice gaps: ensure voice verification passes

### For ADMIN Users:
- Use appropriate role for day-to-day work (not ADMIN)
- Review audit logs periodically
- Manage user roles based on organizational hierarchy
- Backup resolution proof documents regularly

---

## Troubleshooting

### "Permission Denied" Error
**Cause:** User role doesn't have permission for the attempted action.  
**Solution:** Contact system administrator to verify your role assignment.

### "Resolution Proof Required" Error
**Cause:** AUTHORITY trying to resolve without uploading proof document.  
**Solution:** Upload the official completion letter/certificate and provide reference number.

### "Voice Verification Failed" Error
**Cause:** Voice doesn't match original complainant's voice.  
**Solution:** Only the person who filed the voice complaint can resolve it. Contact them to perform voice verification.

---

## Contact & Support

For role assignment requests or permission issues:
- Contact your **System Administrator**
- Provide: Username, desired role, justification

For technical issues:
- Report via internal support system
- Include: Screenshot, error message, steps to reproduce

---

**Last Updated:** January 8, 2026  
**Version:** 1.0  
**Scope:** Andhra Pradesh, Internal Government Use Only
