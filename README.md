# Wardrobe Closet App

Upload photos of your shirts and pants, get them auto-tagged, generate a
matching outfit, and render it on a mannequin using Gemini.

## Steps remaining to go live (steps 4-6 of the plan)

### 4. Push to GitHub
1. Create a new empty repository on GitHub (no README, no .gitignore — this
   project already has one).
2. In this project folder, run:
   ```
   git init
   git add .
   git commit -m "Initial wardrobe app"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

### 5. Deploy on Vercel
1. Go to vercel.com and sign in with your GitHub account.
2. Click "Add New Project" and pick this repository.
3. Vercel will auto-detect it's a Vite project — leave the build settings
   as default.
4. Before deploying, go to the project's **Settings → Environment Variables**
   and add:
   - Key: `GEMINI_API_KEY`
   - Value: your actual Gemini API key
5. Click Deploy. You'll get a live URL like `your-app.vercel.app`.

### 6. Test the live app
Open the Vercel URL on your phone, upload photos, generate an outfit, and
tap "Render on mannequin" — this now calls your own `/api/render-outfit`
backend instead of Gemini directly, so the key stays safely on the server
and the browser sandbox restriction from before no longer applies.

## Local development (optional)
```
npm install
npm run dev
```
Note: the `/api/render-outfit` function only runs when deployed on Vercel
(or via `vercel dev` locally with the Vercel CLI installed).
