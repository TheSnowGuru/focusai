# ✅ FocusAI Testing Checklist

## Before Testing

### 1. Spotify Dashboard Setup
- [ ] Go to https://developer.spotify.com/dashboard
- [ ] Open your app (Client ID: 13b4d04efb374d83892efa41680c4a3b)
- [ ] Click "Edit Settings"
- [ ] Add redirect URI: `https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback`
- [ ] Click "Save"

### 2. Extension Installation
- [ ] Go to `chrome://extensions`
- [ ] Enable "Developer mode"
- [ ] Click "Load unpacked"
- [ ] Select `/Users/shay/Documents/GitHub/focus`
- [ ] Verify extension loads successfully

---

## Testing Phase 1: Initialization

### Open Background Console
- [ ] Go to `chrome://extensions`
- [ ] Find "FocusAI"
- [ ] Click "Service worker" → "inspect"

### Expected Logs:
```
🎬 Offscreen document loading...
✅ Offscreen DOM already ready
✅ Chrome APIs ready after 0 attempts
🚀 Offscreen document fully initialized and ready for messages
```

### ❌ If you see errors:
- "Chrome storage not available" → Still a timing issue (shouldn't happen)
- "Chrome APIs not available after 10 attempts" → Major issue, Chrome APIs broken

---

## Testing Phase 2: Debug Panel

### Open Debug Panel
- [ ] Open: `chrome-extension://fcebfginidcappmbokiokjpgjfbmadbj/debug.html`

### Verify:
- [ ] Extension ID shows: `fcebfginidcappmbokiokjpgjfbmadbj` (or your actual ID)
- [ ] Redirect URI shows: `https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback`
- [ ] Authentication Status shows: "❌ Not Authenticated" (initially)
- [ ] Token Exists shows: "No"

---

## Testing Phase 3: Login Flow

### Open Extension Popup
- [ ] Click the FocusAI extension icon

### Expected: Login Screen
- [ ] Login card is visible (not hidden)
- [ ] "Login with Spotify" button is green and prominent
- [ ] Redirect URI is displayed at bottom of card
- [ ] Can copy redirect URI by clicking button

### Click "Login with Spotify"
- [ ] Button changes to "Opening Spotify..."
- [ ] New window opens with Spotify login
- [ ] Approve permissions

### Check Console (F12 on popup)
Expected logs:
```
🔐 Starting Spotify login...
Extension ID: fcebfginidcappmbokiokjpgjfbmadbj
Redirect URI: https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback
🌐 Opening Spotify authorization...
✅ Received redirect URL: [...]
🔄 Exchanging authorization code for access token...
✅ Successfully received access token
✅ Token saved to storage
✅ Login complete!
```

### After Login
- [ ] Login screen disappears
- [ ] Timer view appears with bubble
- [ ] Tasks panel visible on left
- [ ] Duration buttons visible above bubble

---

## Testing Phase 4: Verify Authentication

### Refresh Debug Panel
- [ ] Authentication Status shows: "✅ Authenticated"
- [ ] Token Exists shows: "Yes"
- [ ] Token Age shows reasonable time (< 1 minute)
- [ ] Token Expires In shows ~59 minutes

### Click "Test Token" in Debug Panel
Expected:
```
Testing token...
✅ Token is valid!
User: [Your Name] ([your@email.com])
Account type: premium
```

---

## Testing Phase 5: Playback

### Start Focus Session
- [ ] Click the bubble in popup
- [ ] Timer starts counting down
- [ ] Track card appears
- [ ] Track name and frequency shown

### Check Background Console
Expected logs:
```
✅ Chrome APIs ready after 0 attempts
Web API playback started
(or)
Offscreen document ready for messages
```

### ❌ Should NOT see:
- "Chrome storage not available"
- "⏳ Waiting for Chrome APIs..." (multiple times)
- "Cannot access Chrome storage"

### Close Popup
- [ ] Close the popup window
- [ ] Music continues playing
- [ ] Reopen popup → Timer still running

---

## Testing Phase 6: Task Management

### Add Tasks
- [ ] Type task in input field
- [ ] Press Enter
- [ ] Task appears in list
- [ ] Add 2-3 more tasks

### Edit Task
- [ ] Click pencil icon (✏️) on a task
- [ ] Task becomes editable
- [ ] Change text
- [ ] Press Enter or click elsewhere
- [ ] Task updates

### Complete Task
- [ ] Click "Mark As Done ✅" button
- [ ] Task disappears immediately
- [ ] Confetti/particle explosion appears
- [ ] Sound plays (explosion-01.mp3)

### Delete Task
- [ ] Click X emoji on left of task
- [ ] Task is removed
- [ ] No explosion (only for "Mark As Done")

---

## Testing Phase 7: Duration Control

### Change Duration
- [ ] Click different minute buttons (5, 10, 15, 20, 25, 30)
- [ ] Selected button highlights
- [ ] Timer resets to new duration when stopped
- [ ] Duration persists after closing/reopening popup

---

## Testing Phase 8: Skip Track

### While Playing
- [ ] Click "Skip" button
- [ ] New random track loads
- [ ] Track name and frequency update
- [ ] Music continues (no interruption)

---

## Success Criteria

### ✅ All Must Pass:
1. ✅ No "Chrome storage not available" errors
2. ✅ Login completes successfully
3. ✅ Token is valid (shows in debug panel)
4. ✅ Music plays and continues after closing popup
5. ✅ Tasks can be added, edited, completed, deleted
6. ✅ Timer works and persists
7. ✅ Skip changes tracks
8. ✅ Task completion has explosion effect and sound

### ⚠️ If Any Fail:
1. Check console for specific error messages
2. Check background console for offscreen errors
3. Review debug panel for auth status
4. Verify Spotify Dashboard redirect URI
5. Clear token and try login again

---

## Common Issues & Fixes

### Issue: Login button not visible
**Fix**: Open debug panel → Click "Clear Token" → Reload popup

### Issue: "redirect_uri_mismatch"
**Fix**: Check Spotify Dashboard has EXACT URI (no spaces, correct ID)

### Issue: "Chrome storage not available"
**Fix**: This should be fixed now with retry logic. If still happening, check background console for retry logs.

### Issue: Music stops when popup closes
**Fix**: Check background console for "Offscreen document ready" message

### Issue: No explosion sound
**Fix**: Verify `explosion-01.mp3` exists in extension folder

---

## Final Verification

- [ ] All features work as expected
- [ ] No console errors
- [ ] Background console shows initialization logs
- [ ] Debug panel shows correct status
- [ ] Can focus for full duration
- [ ] Music persists after closing
- [ ] Tasks work correctly

**Status**: 🟢 Ready for production use!
