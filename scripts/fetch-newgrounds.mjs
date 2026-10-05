#!/usr/bin/env node
import fs from "node:fs/promises";

const OUTPUT = "data/media.json";
const BASE = "https://www.newgrounds.com/search/conduct/art?match=tags&tags=femgram";
const MAX_PAGES = 5;
const MAX_ITEMS = 60;

function decodeHtml(value=""){
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function meta(html, property){
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return decodeHtml(html.match(re)?.[1] || "");
}

function jsonLd(html){
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for(const match of matches){
    try{
      const parsed = JSON.parse(match[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const hit = nodes.find(x => x && (x.datePublished || x.author || x.image));
      if(hit) return hit;
    }catch{}
  }
  return {};
}

function sensitive(html){
  return /(?:>|"|\b)(explicit|nsfw|nudity|sexual)(?:<|"|\b)/i.test(html);
}

function reusable(html){
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  if(/you may not use this work for any purposes/i.test(text)) return false;
  return /attribution:/i.test(text) || /creative commons/i.test(text);
}

async function fetchText(url){
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.8",
      "user-agent": "FemgramHub/0.1 (Newgrounds source-aware catalogue collector)"
    }
  });
  if(!response.ok) throw new Error(`Newgrounds HTTP ${response.status}`);
  return response.text();
}

async function searchPage(page){
  const url = page === 1 ? BASE : `${BASE}&page=${page}`;
  const html = await fetchText(url);
  const hrefs = [...html.matchAll(/href=["'](\/art\/view\/[^"']+)["']/gi)]
    .map(m => `https://www.newgrounds.com${m[1].split("#")[0]}`);
  return [...new Set(hrefs)];
}

async function parseItem(url){
  const html = await fetchText(url);
  if(sensitive(html) || !reusable(html)) return null;

  const image = meta(html, "og:image");
  if(!image) return null;

  const data = jsonLd(html);
  const title = meta(html, "og:title") || data.name || "Femgram";
  const artist = typeof data.author === "object" ? data.author?.name : (data.author || "Newgrounds artist");
  const date = data.datePublished || new Date().toISOString();

  return {
    id: `newgrounds-auto-${Buffer.from(url).toString("base64url").slice(0, 60)}`,
    type: "image",
    title: String(title).replace(/\s*\|\s*Newgrounds.*$/i, "").slice(0, 120),
    artist: String(artist).slice(0, 120),
    source: "Newgrounds",
    sourceUrl: url,
    thumbnail: image,
    media: image,
    tags: ["femgram","newgrounds"],
    likes: 0,
    date,
    rights: "See Newgrounds licensing terms on source page"
  };
}

async function main(){
  const existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  const merged = new Map(existing.map(item => [item.id, item]));
  const urls = new Set();

  for(let page = 1; page <= MAX_PAGES && urls.size < MAX_ITEMS; page++){
    try{
      const found = await searchPage(page);
      found.forEach(url => urls.add(url));
      console.log(`Newgrounds page ${page} -> ${found.length} candidates`);
    }catch(error){
      console.warn(`Newgrounds search page ${page} failed: ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 1200));
  }

  let added = 0;
  for(const url of [...urls].slice(0, MAX_ITEMS)){
    try{
      const item = await parseItem(url);
      if(item){
        if(!merged.has(item.id)) added++;
        merged.set(item.id, item);
      }
    }catch(error){
      console.warn(`Newgrounds item skipped: ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`Newgrounds added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
