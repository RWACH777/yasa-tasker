# Final Implementation Steps - Tasker/Freelancer Workflow

## 🎯 What You Need to Do

Follow these steps in order. Each step is independent and can be done separately.

---

## STEP 1: Create Notifications Table in Supabase ⭐ DO THIS FIRST

**File:** `NOTIFICATIONS_MIGRATION.sql`

**Action:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire content from `NOTIFICATIONS_MIGRATION.sql`
3. Paste it into the SQL Editor
4. Click "Run" button

**What it does:**
- Creates `notifications` table
- Adds indexes for fast queries
- Enables Row Level Security (RLS)
- Allows users to see only their own notifications

**Verify it worked:**
- Go to Supabase Dashboard → Tables
- You should see `notifications` table in the list

---

## STEP 2: Update Tasker View - Count Pending Applications

**File:** `app/dashboard/page.tsx` (lines 327-332)

**Current Code:**
```typescript
if (tasks) {
  const active = tasks.filter((t) => t.status === "active");
  const pending = tasks.filter((t) => t.status === "open");
  const completed = tasks.filter((t) => t.status === "completed");
  setProfileTasks({ active, pending, completed });
}
```

**Replace With:**
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

**Why:** Tasker's "Pending" count now shows tasks with pending applications waiting for review

---

## STEP 3: Send Notifications on Approve

**File:** `app/dashboard/page.tsx` (lines 452-482)

**Update `handleApproveApplication` function:**

**Add these imports at the top:**
```typescript
import { sendApprovalNotification } from "@/app/utils/notificationHelpers";
```

**Update the function:**
```typescript
const handleApproveApplication = async (applicationId: string, applicantId: string) => {
  setReviewLoading(true);
  const { error } = await supabase
    .from("applications")
    .update({ status: "approved" })
    .eq("id", applicationId);

  if (error) {
    setMessage("❌ Failed to approve: " + error.message);
  } else {
    setMessage("✅ Application approved!");
    
    // Update task status to active
    const { data: taskData } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", reviewTaskId)
      .single();

    // Send notification to freelancer
    if (taskData) {
      await sendApprovalNotification(
        applicantId,
        reviewTaskId,
        applicationId,
        taskData.title
      );
    }

    // Refresh applications list
    if (reviewTaskId) {
      const { data } = await supabase
        .from("applications")
        .select("*")
        .eq("task_id", reviewTaskId)
        .order("created_at", { ascending: false });
      setTaskApplications(data || []);
      
      // Update task status to active
      await supabase
        .from("tasks")
        .update({ status: "active" })
        .eq("id", reviewTaskId);
    }
    
    loadProfileTasks();
    // Auto-open chatroom
    router.push(`/chatroom/${applicantId}?freelancer=true`);
  }
  setReviewLoading(false);
};
```

---

## STEP 4: Send Notifications on Deny

**File:** `app/dashboard/page.tsx` (lines 485-507)

**Add import (if not already added):**
```typescript
import { sendDenialNotification } from "@/app/utils/notificationHelpers";
```

**Update `handleDenyApplication` function:**
```typescript
const handleDenyApplication = async (applicationId: string) => {
  setReviewLoading(true);
  
  // Get application details for notification
  const { data: appData } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .single();

  const { error } = await supabase
    .from("applications")
    .update({ status: "denied" })
    .eq("id", applicationId);

  if (error) {
    setMessage("❌ Failed to deny: " + error.message);
  } else {
    setMessage("✅ Application denied!");
    
    // Get task title for notification
    const { data: taskData } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", reviewTaskId)
      .single();

    // Send notification to freelancer
    if (appData && taskData) {
      await sendDenialNotification(
        appData.applicant_id,
        reviewTaskId,
        applicationId,
        taskData.title
      );
    }

    // Refresh applications list
    if (reviewTaskId) {
      const { data } = await supabase
        .from("applications")
        .select("*")
        .eq("task_id", reviewTaskId)
        .order("created_at", { ascending: false });
      setTaskApplications(data || []);
    }
  }
  setReviewLoading(false);
};
```

---

## STEP 5: Display Freelancer Notifications in NotificationsModal

**File:** `app/components/NotificationsModal.tsx` (lines 42-95)

**Update the `loadNotifications` function:**

**Add import at top:**
```typescript
import { loadNotifications } from "@/app/utils/notificationHelpers";
```

**Replace the loadNotifications function:**
```typescript
const loadNotifications = async () => {
  setLoading(true);
  
  if (userRole === "tasker") {
    // Tasker: Load pending applications
    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("task_id", (await supabase.from("tasks").select("id").eq("poster_id", userId)).data?.map(t => t.id))
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setNotifications(data || []);
  } else {
    // Freelancer: Load notifications
    const notifs = await loadNotifications(userId);
    setNotifications(notifs as any);
  }
  
  setLoading(false);
};
```

**Update the display logic (around line 140):**

**Add this after the pending applications section:**
```typescript
{userRole === "freelancer" && selectedNotification && (
  <div className="space-y-3">
    <p className="text-sm text-gray-300">{selectedNotification.message}</p>
    {selectedNotification.type === "application_approved" && (
      <button
        onClick={() => {
          if (onOpenChat) {
            onOpenChat(selectedNotification.applicant_id);
            setSelectedNotification(null);
          }
        }}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
      >
        💬 Open Chat
      </button>
    )}
  </div>
)}
```

---

## STEP 6: Add Task Completion Flow in Chat

**File:** `app/chat/page.tsx` (around line 400-470)

**Add this before the message input section:**

```typescript
{/* Task Completion Button - Only show for tasker */}
{user?.id === otherUserId && (
  <div className="mb-4 p-3 bg-green-600/20 border border-green-600/50 rounded-lg">
    <p className="text-sm text-green-300 mb-2">Task Completion</p>
    <button
      onClick={async () => {
        // Update task status to completed
        const { error } = await supabase
          .from("tasks")
          .update({ status: "completed" })
          .eq("id", taskId);

        if (!error) {
          setMessage("✅ Task marked as completed!");
          // Send completion notification
          const { sendCompletionNotification } = await import("@/app/utils/notificationHelpers");
          await sendCompletionNotification(user.id, otherUserId, taskId, "Task");
        }
      }}
      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-semibold"
    >
      ✅ Mark Task as Completed
    </button>
  </div>
)}
```

---

## 📋 Checklist - Do This in Order

- [ ] **Step 1:** Run SQL migration to create notifications table
- [ ] **Step 2:** Update Tasker View pending count logic
- [ ] **Step 3:** Add sendApprovalNotification to handleApproveApplication
- [ ] **Step 4:** Add sendDenialNotification to handleDenyApplication
- [ ] **Step 5:** Update NotificationsModal to display freelancer notifications
- [ ] **Step 6:** Add task completion button in chat

---

## 🧪 Testing the Workflow

### Test Tasker Flow:
1. Login as User A (tasker)
2. Post a task
3. Logout, login as User B (freelancer)
4. Apply to User A's task
5. Logout, login as User A
6. Open profile → Pending Tasks should show 1
7. Click "Review Applications"
8. Click "Approve" → Should auto-open chat
9. User B should receive notification

### Test Freelancer Flow:
1. Login as User B
2. Check Notifications → Should see approval message
3. Click "Open Chat" → Should go to chat room
4. In chat, User A should see "Mark Task as Completed" button
5. Click it → Both get completion notification

---

## ⚠️ Important Notes

- **Notifications table must be created first** - All other steps depend on it
- **Use smaller edits** - Don't try to edit the entire dashboard.tsx at once
- **Test each step** - Don't move to the next step until current one works
- **Check browser console** - Look for errors if something doesn't work
- **Verify RLS policies** - Make sure notifications table has proper permissions

---

## 🆘 If Something Goes Wrong

1. **Notifications not showing?**
   - Check Supabase → Tables → notifications exists
   - Check RLS policies are enabled
   - Check browser console for errors

2. **Tasker view not updating?**
   - Make sure you replaced the exact code in loadProfileTasks
   - Refresh the page
   - Check browser console

3. **Notifications not sending?**
   - Check that notificationHelpers.ts is imported correctly
   - Check Supabase logs for insert errors
   - Verify user_id is correct

4. **Chat completion not working?**
   - Make sure taskId is passed to chat page
   - Check that user.id matches tasker_id
   - Verify task table has status column

---

## 📞 Summary

You now have:
- ✅ Deny button in notifications
- ✅ Notification helper functions
- ✅ SQL migration for notifications table
- ✅ Step-by-step implementation guide

**Next:** Follow the 6 steps above to complete the workflow!
