export type ParsedFeedItem = {
  url: string;
  title: string;
  body: string;
  publishedAt: Date;
};

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function tag(block: string, name: string): string {
  const cdata = block.match(new RegExp(`<${name}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`, "i"));
  if (cdata?.[1]) {
    return decodeXml(cdata[1].trim());
  }
  const plain = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return decodeXml((plain?.[1] ?? "").trim());
}

function href(block: string): string {
  const atom = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (atom?.[1]) {
    return decodeXml(atom[1]);
  }
  return tag(block, "link");
}

export function parseFeed(xml: string): ParsedFeedItem[] {
  const chunks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];
  return chunks.map((block) => {
    const published = tag(block, "pubDate") || tag(block, "updated") || tag(block, "published");
    return {
      url: href(block),
      title: tag(block, "title"),
      body: tag(block, "description") || tag(block, "summary") || tag(block, "content"),
      publishedAt: published ? new Date(published) : new Date(0),
    };
  });
}
