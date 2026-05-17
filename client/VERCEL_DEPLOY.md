# Deploying the client to Vercel

1. Push repository to GitHub (or Git provider).
2. In Vercel, create a new Project → Import Git Repository.
   - Set the **Root Directory** to `messenger-app/client`.
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Add Environment Variables in Vercel settings:
   - `VITE_SERVER_URL` = `https://your-server.example.com` (set after server is deployed)
4. Deploy. Vercel will run `npm install` and `npm run build` and publish the `dist` folder.

Notes
- This project is a Vite SPA — `vercel.json` already configures the static build and SPA routing.
- The client expects `VITE_SERVER_URL` (defaults to `http://localhost:4000` locally).

# Server deployment recommendation

This app uses Socket.IO and long-lived WebSocket connections. Vercel Serverless functions are not suitable for persistent sockets. Recommended options:

- Render (https://render.com): deploy the `server` as a Web Service using the included `Dockerfile` or `npm start`.
- Railway / Fly / DigitalOcean App Platform: these support long-running Node servers and WebSockets.

Quick Render steps (Docker):
1. Create new Web Service → Connect your repo.
2. Set the Root to `messenger-app/server` and choose Docker (auto-detect uses `Dockerfile`).
3. Set environment variables (DB, JWT_SECRET, etc.) from your `.env`.
4. Deploy. Copy the public URL and set `VITE_SERVER_URL` in Vercel.
