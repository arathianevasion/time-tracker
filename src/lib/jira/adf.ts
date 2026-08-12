export interface AdfDoc {
  type: "doc";
  version: 1;
  content: unknown[];
}

/** Minimal valid Atlassian Document Format wrapper for a single plain-text paragraph. */
export function textToAdf(text: string): AdfDoc {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}
