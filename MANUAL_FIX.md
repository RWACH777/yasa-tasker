# Manual Fix - Tasker View Pending Count

## STEP 1: Fix Tasker View Pending Count

**File:** `app/dashboard/page.tsx`

**Find this code (around line 329-349):**
```typescript
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
```

**Replace with this:**
```typescript
if (tasks) {
  const active = tasks.filter((t) => t.status === "active");
  const pending = tasks.filter((t) => t.status === "open");
  const completed = tasks.filter((t) => t.status === "completed");
  setProfileTasks({ active, pending, completed });
}
```

**Why:** 
- Tasker View should ONLY show task counts by status
- Pending = tasks with status "open"
- Active = tasks with status "active"
- Completed = tasks with status "completed"
- Application management happens in NOTIFICATIONS, not here

---

## STEP 2: Test Submit Button

1. **Hard refresh browser:** `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
2. **Try submitting empty application form** - Should show error and disable submit button
3. **Fill one field** - Submit button should still be disabled
4. **Fill all fields** - Submit button should enable and work

If still broken:
- Check browser console for errors (F12)
- Clear browser cache completely
- Try in incognito/private window

---

## STEP 3: Verify Workflow

**Tasker:**
1. Post a task → should appear in "Pending Tasks" count
2. Freelancer applies → notification in Notifications modal
3. Click "Review Applications" in profile
4. See Approve/Deny buttons
5. Click Approve → auto-opens chat

**Freelancer:**
1. Apply to task → application submitted
2. Check Notifications → should see approval/denial message
3. If approved → "Open Chat" button appears

---

## After Making Changes

1. Save file
2. Hard refresh browser (Ctrl+Shift+R)
3. Test the workflow
4. Commit to git: `git add -A && git commit -m "Fix tasker view pending count" && git push`
