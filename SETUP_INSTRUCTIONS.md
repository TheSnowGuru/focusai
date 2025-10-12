# 🚀 FocusAI Setup Instructions

## ✅ Critical: Spotify Dashboard Setup

### Step 1: Add Redirect URI to Spotify Dashboard

1. Go to: https://developer.spotify.com/dashboard
2. Login with your Spotify account
3. Click on your app (or create one if you don't have it)
4. Click **"Edit Settings"**
5. Scroll to **"Redirect URIs"**
6. Add this EXACT URI:
   ```
   https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback
   ```
7. Click **"Add"**
8. Scroll down and click **"Save"**

### Step 2: Verify Client ID

Make sure your app uses this Client ID:
```
13b4d04efb374d83892efa41680c4a3b
```

If it's different, update it in:
- `popup.js` (line ~487)
- `background.js` (line 1)

---

## 🔧 Extension Installation

### Step 1: Load Extension in Chrome

1. Open Chrome
2. Go to: `chrome://extensions`
3. Enable **"Developer mode"** (toggle in top right)
4. Click **"Load unpacked"**
5. Select the `/Users/shay/Documents/GitHub/focus` folder
6. Extension should now appear with the ID: `fcebfginidcappmbokiokjpgjfbmadbj`

### Step 2: Verify Extension ID

**IMPORTANT**: The extension ID MUST be `fcebfginidcappmbokiokjpgjfbmadbj` to match the redirect URI.

If it's different:
1. Uninstall the extension
2. Delete the extension folder
3. Re-clone or re-download
4. Load unpacked again

The ID is determined by the first installation, so you may need to:
- Pack the extension with a specific key
- OR update all redirect URIs to match the new ID

---

## 🧪 Testing

### Step 1: Open Debug Panel

Open this URL in Chrome:
```
chrome-extension://fcebfginidcappmbokiokjpgjfbmadbj/debug.html
```

You should see:
- ✅ Redirect URI: `https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback`
- ❌ Not Authenticated (initially)

### Step 2: Test Login

1. Click the FocusAI extension icon
2. You should see either:
   - **Login screen** (if not authenticated)
   - **Timer screen** (if already authenticated)
3. If you see the login screen:
   - Verify the redirect URI matches
   - Click "Login with Spotify"
   - Approve permissions
   - Should redirect back and show timer

### Step 3: Check Console

Open DevTools (F12) and look for:
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

---

## 🐛 Troubleshooting

### Issue: Login button doesn't appear

**Cause**: Extension thinks you're already authenticated

**Fix**:
1. Open debug panel
2. Click "Clear Token"
3. Reload extension popup
4. Login button should now appear

### Issue: Wrong redirect URI shown

**Cause**: Extension ID doesn't match

**Fix**:
1. Check extension ID in `chrome://extensions`
2. If it doesn't match `fcebfginidcappmbokiokjpgjfbmadbj`:
   - Update Spotify Dashboard with the new URI
   - OR reinstall extension to get correct ID

### Issue: "redirect_uri_mismatch" error

**Cause**: Redirect URI in code doesn't match Spotify Dashboard

**Fix**:
1. Go to Spotify Dashboard → Edit Settings
2. Verify redirect URI is EXACTLY:
   ```
   https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback
   ```
3. No extra spaces, characters, or variations
4. Must be in the "Redirect URIs" list
5. Must click "Save" after adding

### Issue: Storage permission error

**Cause**: Permission might not be granted

**Fix**:
1. Check `manifest.json` has `"storage"` in `permissions` array
2. Reload extension
3. Chrome should auto-grant storage permission

---

## 📝 Files with Hardcoded Redirect URI

These files use the redirect URI `https://fcebfginidcappmbokiokjpgjfbmadbj.chromiumapp.org/callback`:

1. `popup.js` - Line ~417 and ~489
2. `background.js` - Line ~23
3. `debug.html` - Line ~171

If you need to change it, update ALL three files.

---

## ✨ Next Steps

1. ✅ Verify Spotify Dashboard has correct redirect URI
2. ✅ Load extension in Chrome
3. ✅ Verify extension ID matches
4. ✅ Open debug panel to check status
5. ✅ Test login flow
6. ✅ Start focusing! 🎵

---

**Need Help?**

1. Open debug panel (`chrome-extension://fcebfginidcappmbokiokjpgjfbmadbj/debug.html`)
2. Check console for error messages
3. Share the console output for debugging

**Status**: 🟢 Ready to use

