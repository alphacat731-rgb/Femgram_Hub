#!/usr/bin/env node
import fs from "node:fs/promises";

const OUTPUT = "data/media.json";
const TAG_URL = "https://rule34vault.com/femgram";
const MAX_POSTS = 60;

function decode(value=""){
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function strip(value=""){
  return decode(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function meta(html, key){
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i")
  ];
  for(const re of patterns){
    const match = html.match(re);
    if(match) return decode(match[1]);
  }
  return "";
}

function titleFromPost(html){
  const og = meta(html, "og:title");
  if(og) return og.replace(/\s*[-|]\s*R34 Vault.*$/i, "").trim().slice(0, 120);

  const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  return title.replace(/\s*[-|]\s*R34 Vault.*$/i, "").trim().slice(0, 120) || "Femgram";
}

function looksForbidden(text){
  return /\b(child|minor|underage|loli|shota)\b/i.test(text);
}

function extractMedia(html){
  const image = meta(html, "og:image") || meta(html, "twitter:image");
  const video = meta(html, "og:video:url") || meta(html, "og:video") || meta(html, "twitter:player:stream");

  const sourceMatches = [...html.matchAll(/<(?:video|source)[^>]+(?:src|data-src)=["']([^"']+)["']/gi)]
    .map(match => decode(match[1]))
    .filter(url => /^https?:\/\//i.test(url));

  const directVideo = sourceMatches.find(url => /\.(?:mp4|webm|mov)(?:\?|$)/i.test(url));
  const directImage = sourceMatches.find(url => /\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(url));

  const mediaVideo = video || directVideo || "";
  const mediaImage = image || directImage || "";

  if(mediaVideo) return {type:"video", media:mediaVideo, thumbnail:mediaImage || mediaVideo};
  if(mediaImage) return {type:"image", media:mediaImage, thumbnail:mediaImage};
  return null;
}

async function fetchText(url){
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.8",
      "user-agent": "FemgramHub/0.1 (source-aware catalogue collector)"
    }
  });
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function collectPostUrls(){
  const html = await fetchText(TAG_URL);
  const urls = [...html.matchAll(/href=["'](\/post\/\d+)["']/gi)]
    .map(m => `https://rule34vault.com${m[1]}`);
  return [...new Set(urls)].slice(0, MAX_POSTS);
}

async function parsePost(url){
  const html = await fetchText(url);
  const text = strip(html);

  if(looksForbidden(text)) return null;

  const found = extractMedia(html);
  if(!found) return null;

  const id = url.match(/\/post\/(\d+)/)?.[1] || Buffer.from(url).toString("base64url").slice(0, 40);

  const tags = [...new Set([
    "femgram",
    "rule34vault",
    ...(text.match(/(?:femgram|geometry dash|animated|furry|fanart)/gi) || []).map(x => x.toLowerCase())
  ])];

  return {
    id: `rule34vault-${id}`,
    type: found.type,
    title: titleFromPost(html),
    artist: "R34 Vault",
    source: "R34 Vault",
    sourceUrl: url,
    thumbnail: found.thumbnail,
    media: found.media,
    tags,
    likes: 0,
    date: meta(html, "article:published_time") || new Date().toISOString(),
    mature: true,
    rights: "See original R34 Vault page and its terms"
  };
}

async function main(){
  const existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  const merged = new Map(existing.map(item => [item.id, item]));

  let added = 0;
  const urls = await collectPostUrls();
  console.log(`R34 Vault discovered ${urls.length} post URLs from ${TAG_URL}`);

  for(const url of urls){
    try{
      const item = await parsePost(url);
      if(item){
        if(!merged.has(item.id)) added++;
        merged.set(item.id, item);
      }
    }catch(error){
      console.warn(`R34 Vault skipped ${url}: ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 600));
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`R34 Vault added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
