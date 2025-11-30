# Tasker/Freelancer Workflow Implementation Guide

## Step 1: Update Tasker View (loadProfileTasks function)

**File:** `app/dashboard/page.tsx` (lines 320-332)

**Current Code:**
```javascript
if (profileView === "tasker") {
  // Load user's posted tasks grouped by status
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("poster_id", user.id);

  if (tasks) {
    const active = tasks.filter((t) => t.status === "active");
    const pending = tasks.filter((t) => t.status === "open");
    const completed = tasks.filter((t) => t.status === "completed");
    setProfileTasks({ active, pending, completed });
  }
}
```

**Replace With:**
```javascript
if (profileView === "tasker") {
  // Load user's posted tasks grouped by status
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("poster_id", user.id);

  if (tasks) {
    const active = tasks.filter((t) => t.status === "active");
    const completed = tasks.filter((t) => t.status === "completed");
    const pending = [];

    // For tasker: pending = tasks with pending applications
    for (const task of tasks) {
      if (task.status === "open") {
        const { data: apps } = await supabase
          .from("applications")
          .select("id")
          .eq("task_id", task.id)
          .eq("status", "pending")
          .limit(1);
        
        if (apps && apps.length > 0) {
          pending.push(task);
        }
      }
    }

    setProfileTasks({ active, pending, completed });
  }
}
```

**What This Does:**
- Tasker's "Pending" count now shows tasks with pending applications (not just "open" status)
- Accurately reflects how many tasks are waiting for the tasker to review applications

---

## Step 2: Update NotificationsModal - Add Deny Button

**File:** `app/components/NotificationsModal.tsx` (lines 157-182)

**Current Code:**
```javascript
{userRole === "tasker" && selectedNotification.status === "pending" && (
  <div className="flex gap-2">
    <button
      onClick={() => {
        if (onApprove) {
          onApprove(selectedNotification.id, selectedNotification.applicant_id);
          setSelectedNotification(null);
        }
      }}
      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-semibold"
    >
      ✓ Approve
    </button>
    <button
      onClick={() => {
        if (onOpenChat) {
          onOpenChat(selectedNotification.applicant_id);
          setSelectedNotification(null);
        }
      }}
      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
    >
      💬 Open Chat
    </button>
  </div>
)}
```

**Replace With:**
```javascript
{userRole === "tasker" && selectedNotification.status === "pending" && (
  <div className="flex gap-2">
    <button
      onClick={() => {
        if (onApprove) {
          onApprove(selectedNotification.id, selectedNotification.applicant_id);
          setSelectedNotification(null);
        }
      }}
      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-semibold"
    >
      ✓ Approve
    </button>
    <button
      onClick={() => {
        // Call onDeny if available
        if (onDeny) {
          onDeny(selectedNotification.id);
          setSelectedNotification(null);
        }
      }}
      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm font-semibold"
    >
      ✗ Deny
    </button>
  </div>
)}
```

**Also Update Props:**
Add `onDeny` to the interface (line 24):
```javascript
onDeny?: (applicationId: string) => void;
```

And destructure it (line 34):
```javascript
onDeny,
```

---

## Step 3: Update Dashboard - Pass onDeny Callback

**File:** `app/dashboard/page.tsx` (lines 744-751)

**Current Code:**
```javascript
<NotificationsModal
  isOpen={showNotificationsModal}
  onClose={() => setShowNotificationsModal(false)}
  userId={user?.id || ""}
  userRole={profileView}
  onApprove={handleApproveApplication}
  onOpenChat={(applicantId) => router.push(`/chat?user=${applicantId}`)}
/>
```

**Replace With:**
```javascript
<NotificationsModal
  isOpen={showNotificationsModal}
  onClose={() => setShowNotificationsModal(false)}
  userId={user?.id || ""}
  userRole={profileView}
  onApprove={handleApproveApplication}
  onDeny={handleDenyApplication}
  onOpenChat={(applicantId) => router.push(`/chat?user=${applicantId}`)}
/>
```

---

## Next Steps (For Future Implementation)

### Step 4: Add Notifications Table
Create a `notifications` table in Supabase with:
- id (UUID)
- user_id (who receives notification)
- type ('application_approved', 'application_denied', 'task_completed')
- related_task_id
- related_application_id
- message
- read (boolean)
- created_at

### Step 5: Send Notifications on Approve/Deny
Update `handleApproveApplication` and `handleDenyApplication` to insert notification records

### Step 6: Display Notifications in NotificationsModal
For freelancer role, show notifications instead of just approved applications

### Step 7: Add Task Completion in Chat
Add auto-completion message and button to mark task as complete

---

## Testing Checklist

- [ ] Post a task as Tasker
- [ ] Apply to task as Freelancer
- [ ] Verify Tasker sees "1" pending task in profile
- [ ] Open Notifications, see application details
- [ ] Click Approve - should auto-open chat
- [ ] Click Deny - should deny application
- [ ] Verify Freelancer gets notification of approval/denial
