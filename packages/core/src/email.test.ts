import { describe, expect, it } from "vitest";

import { emailTemplate, escapeHtml } from "./email";

describe("email", () => {
  it("escapes HTML", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
  });

  it("escapes the heading and action url in the template", () => {
    const html = emailTemplate({
      appName: "A<b>",
      heading: "<img>",
      body: "<p>ok</p>",
      actionUrl: 'https://x.test/?a="1"',
    });
    expect(html).not.toContain("<img>");
    expect(html).toContain("&lt;img&gt;");
    expect(html).toContain("&quot;1&quot;");
  });
});
