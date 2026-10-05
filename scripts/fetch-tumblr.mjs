#!/usr/bin/env node
import fs from "node:fs/promises";

const OUTPUT = "data/media.json";
const TAGS = ["femgram", "femgramart", "femgramfanart"];
const RSS_BASE = "https://www.tumblr.com/tagged/";
const NS = "http://search.yahoo.com/mrss/";

function decode(value=""){
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function strip(value=""){
  return decode(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function attr(tag, name){
  const re = new RegExp(`${name}=["']([^"']+)["']`, "i");
  return decode(tag.match(re)?.[1] || "");
}

function textOf(block, tag){
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  return strip(block.match(re)?.[1] || "");
}

function links(block){
  return [...block.matchAll(/<(?:media:content|enclosure)[^>]+>/gi)]
    .map(m => attr(m[0], "url"))
    .filter(Boolean);
}

function blocked(block){
  const text = strip(block);
  return /\b(child|minor|underage|loli|shota)\b/i.test(text) ||
         /\b(?:nsfw|explicit|sexual|nudity)\b/i.test(text);
}

async function search(tag){
  const response = await fetch(`${RSS_BASE}${encodeURIComponent(tag)}/rss`, {
    headers: {
      "accept": "application/rss+xml, application/xml, text/xml",
      "user-agent": "FemgramHub/0.1 (public RSS collector)"
    }
  });

  if(!response.ok) throw new Error(`Tumblr RSS HTTP ${response.status}`);
  const xml = await response.text();
  const items = [];

  for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
    const block = match[1];
    if(blocked(block)) continue;

    const mediaUrls = links(block)
      .filter(url => /\.(?:jpe?g|png|gif|webp)(?:\?|$)/i.test(url));

    const title = textOf(block, "title") || "Femgram";
    const creator = textOf(block, "dc:creator") || textOf(block, "author") || "Tumblr creator";
    const sourceUrl = textOf(block, "link") || "https://www.tumblr.com/";
    const date = textOf(block, "pubDate") || new Date().toISOString();

    for(const [index, media] of mediaUrls.slice(0, 4).entries()){
      items.push({
        id: `tumblr-${Buffer.from(sourceUrl).toString("base64url").slice(0, 48)}-${index}`,
        type: /\.gif(?:\?|$)/i.test(media) ? "gif" : "image",
        title: title.slice(0, 120),
        artist: creator.replace(/^@/,"").slice(0, 100),
        source: "Tumblr",
        sourceUrl,
        thumbnail: media,
        media,
        tags: ["femgram","tumblr",tag],
        likes: 0,
        date,
        rights: "See original Tumblr post"
      });
    }
  }

  return items;
}

async function main(){
  const existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  const merged = new Map(existing.map(item => [item.id, item]));
  let added = 0;

  for(const tag of TAGS){
    try{
      const items = await search(tag);
      for(const item of items){
        if(!merged.has(item.id)) added++;
        merged.set(item.id, item);
      }
      console.log(`Tumblr #${tag} -> ${items.length}`);
    }catch(error){
      console.warn(`Tumblr #${tag} skipped: ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`Tumblr added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
