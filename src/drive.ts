import { google, type drive_v3 } from "googleapis";
import { GoogleAuth } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

const GOOGLE_DOC_EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.drawing": "image/svg+xml",
};

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-yaml",
  "application/x-httpd-php",
  "application/graphql",
  "application/x-sh",
]);

export interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: string | null;
  modifiedTime: string | null;
  createdTime: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
}

export interface ReadFileResult {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  content: string | null;
  contentType: string | null;
  note: string | null;
}

function getFolderId(): string {
  const id = process.env.DRIVE_FOLDER_ID?.trim();
  if (!id) {
    throw new Error("DRIVE_FOLDER_ID environment variable is not set");
  }
  return id;
}

function getDrive(): drive_v3.Drive {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!encoded) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set");
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid base64-encoded JSON");
  }

  const auth = new GoogleAuth({ credentials, scopes: SCOPES });
  return google.drive({ version: "v3", auth });
}

function isTextMime(mimeType: string): boolean {
  if (TEXT_MIME_EXACT.has(mimeType)) return true;
  return TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

export async function listFiles(query?: string, limit = 100): Promise<FileItem[]> {
  const drive = getDrive();
  const folderId = getFolderId();

  const clauses = [`'${folderId}' in parents`, "trashed = false"];
  if (query && query.trim()) {
    const safe = query.trim().replace(/['\\]/g, "\\$&");
    clauses.push(`name contains '${safe}'`);
  }

  const res = await drive.files.list({
    q: clauses.join(" and "),
    pageSize: Math.min(Math.max(limit, 1), 1000),
    orderBy: "folder, name",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields:
      "nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink)",
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
    size: f.size ?? null,
    modifiedTime: f.modifiedTime ?? null,
    createdTime: f.createdTime ?? null,
    webViewLink: f.webViewLink ?? null,
    webContentLink: f.webContentLink ?? null,
  }));
}

export async function readFile(fileId: string, format?: string): Promise<ReadFileResult> {
  const drive = getDrive();

  const meta = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "id, name, mimeType, size, modifiedTime, webViewLink",
  });
  const mimeType = meta.data.mimeType ?? "";
  const base = {
    id: meta.data.id ?? fileId,
    name: meta.data.name ?? "",
    mimeType,
    size: meta.data.size ?? null,
    modifiedTime: meta.data.modifiedTime ?? null,
    webViewLink: meta.data.webViewLink ?? null,
  };

  let content: string | null = null;
  let contentType: string | null = null;
  let note: string | null = null;

  const exportMime =
    format === "markdown" && mimeType === "application/vnd.google-apps.document"
      ? "text/markdown"
      : GOOGLE_DOC_EXPORT_MIME[mimeType];

  if (exportMime) {
    const res = await drive.files.export(
      { fileId, mimeType: exportMime },
      { responseType: "text" }
    );
    content = res.data as string;
    contentType = exportMime;
  } else if (isTextMime(mimeType)) {
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    content = res.data as string;
    contentType = mimeType;
  } else {
    note =
      "Binary file: content cannot be read as text. Use webViewLink/webContentLink to view or download.";
  }

  return { ...base, content, contentType, note };
}
