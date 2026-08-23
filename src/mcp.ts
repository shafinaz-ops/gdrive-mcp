import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listFiles, readFile } from "./drive.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "gdrive-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "list_files",
    {
      title: "List Drive files",
      description:
        "List files and folders inside the configured Google Drive folder. Returns id, name, mimeType, size and links for each item.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Optional filter: only return files whose name contains this text."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Maximum number of results to return (default 100)."),
      },
    },
    async ({ query, limit }) => {
      try {
        const files = await listFiles(query, limit ?? 100);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(files, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `list_files failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "read_file",
    {
      title: "Read Drive file",
      description:
        "Read the text content of a file in the Google Drive folder. Google Docs, Sheets and Slides are exported automatically. Binary files return metadata and a download link instead.",
      inputSchema: {
        fileId: z.string().describe("The Google Drive file ID to read."),
        format: z
          .enum(["text", "markdown", "csv"])
          .optional()
          .describe("Export format for Google documents/spreadsheets (default depends on file type)."),
      },
    },
    async ({ fileId, format }) => {
      try {
        const result = await readFile(fileId, format);
        if (result.content !== null) {
          return { content: [{ type: "text" as const, text: result.content }] };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `read_file failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
