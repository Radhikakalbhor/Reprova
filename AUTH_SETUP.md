# Reprova Authentication & Database Setup Guide

Reprova features secure user authentication and session management built natively on **NextAuth.js v4**, **MongoDB**, **bcryptjs**, and **Zod**.

---

## 1. Architecture & Security Overview

- **Authentication Framework:** NextAuth.js (v4) with JWT session strategy (30-day session lifetime).
- **Supported Providers:**
  - **Credentials Provider:** Email or Username + Password.
  - **Google OAuth 2.0:** "Continue with Google" one-click sign in / sign up.
- **Database:** MongoDB (Database: `reprova`, Collection: `users`).
- **Security Safeguards:**
  - Passwords hashed with `bcryptjs` using a cost factor of **12**; passwords and hashes are never exposed to the client.
  - Idempotent unique indexes on `email` and `username`.
  - Account linking: Signing in via Google with an existing credentials email links to the account rather than duplicating it.
  - Route protection: `/analyze` and `/results` are protected via Node.js Server Component route guards (`src/lib/auth-guard.ts`), preserving query parameters upon redirection to `/signin?callbackUrl=...`.
  - Authenticated users visiting `/signin` or `/signup` are automatically redirected to `/analyze`.

---

## 2. Environment Variables Configuration

Copy `.env.local.example` inside `frontend/` to create your local `.env.local`:

```bash
cd frontend
cp .env.local.example .env.local
```

### Environment Variables Reference

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/reprova` |
| `NEXTAUTH_URL` | Canonical root URL of the Next.js app | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret key for signing session JWT tokens | Min 32-character random string |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console | `*.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret from Google Cloud Console | `GOCSPX-...` |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL | `http://localhost:8000` |

### Generating `NEXTAUTH_SECRET`
Generate a cryptographically secure 32-byte secret:

**macOS / Linux / Git Bash:**
```bash
openssl rand -base64 32
```

**PowerShell (Windows):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## 3. MongoDB Setup Options

Reprova works seamlessly with both local MongoDB instances and MongoDB Atlas cloud clusters.

### Option A: Local MongoDB (Community Edition or Docker)

If you have MongoDB running locally on port 27017:
```env
MONGODB_URI=mongodb://localhost:27017/reprova
```

To run a lightweight local MongoDB instance with Docker:
```bash
docker run -d --name reprova-mongo -p 27017:27017 -v reprova_data:/data/db mongo:6
```

### Option B: MongoDB Atlas (Free Cloud Tier)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. Create a free **M0 Sandbox** cluster.
3. Under **Security > Database Access**, add a database user with read/write permissions.
4. Under **Security > Network Access**, add your IP address (or `0.0.0.0/0` for development).
5. Click **Connect > Drivers > Node.js** and copy the connection string:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/reprova?retryWrites=true&w=majority
   ```

---

## 4. Google OAuth 2.0 Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project (e.g., `Reprova-Auth`).
3. Navigate to **APIs & Services > OAuth consent screen**:
   - Choose **External** user type and click **Create**.
   - Set **App name** to `Reprova`.
   - Set **User support email** and **Developer contact email**.
   - In **Scopes**, add `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
   - Add your test Google accounts under **Test users**.
4. Navigate to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Reprova Web Client`.
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
   - **Authorized redirect URIs:**
     - `http://localhost:3000/api/auth/callback/google`
5. Copy your **Client ID** and **Client Secret** into `frontend/.env.local`:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

---

## 5. Development & Testing Workflow

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run Next.js Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 6. Acceptance Criteria Verification

### Test 1: Sign Up with Credentials
1. Navigate to [http://localhost:3000/signup](http://localhost:3000/signup).
2. Enter a username (3-24 characters, letters/numbers/underscore), email, and password (at least 8 chars with letters & numbers).
3. Confirm password matches and notice the dynamic password strength meter.
4. Click **Create Account**.
5. **Expected Result:** Account is created in MongoDB with bcrypt hash (cost 12), user is automatically logged in and redirected to `/analyze`. The Header displays the user avatar/initials with username.

### Test 2: Sign Out & Sign In with Credentials
1. Click the user avatar in the Header and select **Sign out**.
2. **Expected Result:** Session is cleared and user is redirected to `/`. Header shows "Sign in" and "Get started".
3. Click **Sign in** (or visit `/signin`).
4. Enter either the username or email and the password.
5. Click **Sign in to Reprova**.
6. **Expected Result:** Session is authenticated and user is redirected to `/analyze`.

### Test 3: Duplicate Registration Validation
1. Log out and visit `/signup`.
2. Try registering with the same username or email used in Test 1.
3. Click **Create Account**.
4. **Expected Result:** Returns status 409 and highlights the specific field with:
   - *"An account with this email already exists."* OR
   - *"This username is already taken."*

### Test 4: Route Protection & Callback URL Preservation
1. Sign out.
2. In your browser address bar, directly navigate to:
   `http://localhost:3000/results?paper_id=paper-llama2`
3. **Expected Result:** Middleware intercepts the request and redirects to:
   `http://localhost:3000/signin?callbackUrl=%2Fresults%3Fpaper_id%3Dpaper-llama2`
4. Enter credentials and click **Sign in**.
5. **Expected Result:** User is immediately redirected back to `/results?paper_id=paper-llama2` with the exact paper ID and analysis data intact.

### Test 5: Google OAuth & Account Linking
1. Visit `/signin` and click **Continue with Google**.
2. Complete Google authentication.
3. **Expected Result:**
   - If user is new: document is created in MongoDB with `provider: "google"` and `passwordHash: null`.
   - If user already had a credentials account with the same email: existing document is updated with `lastLoginAt` and Google profile image without creating a duplicate record.
   - If an account registered exclusively via Google tries to log in with arbitrary passwords on the credentials form, it displays: *"This account uses Google sign-in. Please continue with Google."*

### Test 6: Mobile Header State
1. Resize your browser window below 768px (or use DevTools mobile device emulation).
2. Verify:
   - When signed out: mobile drawer shows "Sign in" and "Get started" buttons.
   - When signed in: mobile drawer shows user avatar/initials, username, "Analyze Paper", and "Sign out" button.
   - Backend health indicator remains functional and live.
