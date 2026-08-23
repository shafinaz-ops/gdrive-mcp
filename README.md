# gdrive-mcp

An MCP (Model Context Protocol) server that exposes a Google Drive folder over
**Streamable HTTP**, built to run on **Vercel** and hosted on **GitHub**.

It provides two tools:

| Tool         | Description                                                            |
| ------------ | ---------------------------------------------------------------------- |
| `list_files` | List files/folders inside the configured Drive folder (optional search) |
| `read_file`  | Read text content, auto-exporting Google Docs/Sheets/Slides            |

## Architecture

- `server.ts` — Node.js HTTP server entrypoint (Streamable HTTP MCP endpoint).
- `src/mcp.ts` — MCP server definition + tools.
- `src/drive.ts` — Google Drive client using a **service account**.

Authentication is read-only (`drive.readonly`) via a Google **service account**.

---

## 1. Google Cloud setup (service account)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. **Enable the Google Drive API**: `APIs & Services` → `Library` → search "Google Drive API" → Enable.
3. **Create a service account**: `IAM & Admin` → `Service Accounts` → `Create Service Account`.
4. Create a **JSON key** for it: open the service account → `Keys` → `Add Key` → `Create New Key` → JSON. Download the file.
5. Note the service account **email** (looks like `name@project.iam.gserviceaccount.com`).
6. **Share the Drive folder** with that email:
   - Open your folder in Google Drive → right-click → `Share`.
   - Paste the service account email, give it **Viewer** access.
7. Copy the **folder ID** (the part after `/folders/` in the URL).

---

## 2. Local setup

```bash
git clone <your-repo-url>
cd gdrive-mcp
npm install
```

Create a `.env` file (copy `.env.example`):

```
DRIVE_FOLDER_ID=1XM-0CtgvW3PGDekC8qLa2ghxRyvTfjwD
GOOGLE_SERVICE_ACCOUNT_KEY=<base64 of service-account.json>
```

Encode the service-account key to base64:

- Linux/macOS: `base64 -w0 service-account.json`
- PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))`

---

## 3. Deploy to Vercel

### Option A — Vercel + GitHub (recommended)

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com) → **Add New → Project** → import the GitHub repo.
3. Add the environment variables (`DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`).
4. Deploy. The MCP endpoint will be:

   ```
   https://<your-project>.vercel.app
   ```

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel env add DRIVE_FOLDER_ID
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY
vercel --prod
```

---

## 4. Push to GitHub (first time)

```bash
git init
git add .
git commit -m "Add gdrive-mcp server"
git branch -M main
git remote add origin https://github.com/<you>/gdrive-mcp.git
git push -u origin main
```

---

## 5. Connect an MCP client

Point your client at the deployed URL with the **Streamable HTTP** transport.
Example `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gdrive": {
      "type": "http",
      "url": "https://<your-project>.vercel.app"
    }
  }
}
```

For clients that use the generic MCP config format:

```json
{
  "mcpServers": {
    "gdrive": {
      "url": "https://<your-project>.vercel.app"
    }
  }
}
```

> The endpoint is **stateless**, so each request creates a fresh transport — ideal
> for serverless. Access is controlled by Google Drive sharing on the service account.

## Environment variables

| Variable                      | Required | Description                                        |
| ----------------------------- | -------- | -------------------------------------------------- |
| `DRIVE_FOLDER_ID`             | Yes      | Google Drive folder ID                             |
| `GOOGLE_SERVICE_ACCOUNT_KEY`  | Yes      | Base64-encoded service-account JSON key            |
