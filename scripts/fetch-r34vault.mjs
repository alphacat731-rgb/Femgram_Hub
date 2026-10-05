#!/usr/bin/env node
import fs from "node:fs/promises";

const OUTPUT = "data/media.json";
const ROOT = "https://rule34vault.com";
const API = `${ROOT}/api/v2/post/search/root`;
const TAG_URL = `${ROOT}/femgram`;
const CDN = "https://r34xyz.b-cdn.net";
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

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

function titleFromPost(html, id){
  const og = meta(html, "og:title");
  if(og) return og.replace(/\s*[-|]\s*R34 Vault.*$/i, "").trim().slice(0, 120);

  const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  return title.replace(/\s*[-|]\s*R34 Vault.*$/i, "").trim().slice(0, 120) || `Femgram #${id}`;
}

function tagsFromPost(post){
  return Array.isArray(post.tags)
    ? post.tags
        .map(tag => typeof tag === "string" ? tag : tag?.value)
        .filter(Boolean)
        .map(String)
    : [];
}

function isForbiddenTagText(values){
  return values.some(value => /\b(child|minor|underage|loli|shota)\b/i.test(String(value)));
}

function mediaUrl(id, type){
  const extension = Number(type) === 0 ? "jpg" : "mp4";
  return `${CDN}/posts/${Math.floor(Number(id) / 1000)}/${id}/${id}.${extension}`;
}

function videoPoster(){
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#0d0f16"/><text x="400" y="245" text-anchor="middle" fill="#9ea5b8" font-family="Arial, sans-serif" font-size="30">R34 Vault video</text><text x="400" y="285" text-anchor="middle" fill="#70778a" font-family="Arial, sans-serif" font-size="18">Open the viewer to play</text></svg>'
  );
}

function mapApiPost(post){
  const id = Number(post?.id);
  if(!Number.isFinite(id)) return null;

  const tags = tagsFromPost(post);
  if(isForbiddenTagText(tags)) return null;

  const type = Number(post.type) === 0 ? "image" : "video";
  const media = mediaUrl(id, post.type);
  const artistTags = Array.isArray(post.tags)
    ? post.tags.filter(tag => Number(tag?.type) === 8 && tag?.value).map(tag => String(tag.value))
    : [];

  return {
    id: `rule34vault-${id}`,
    type,
    title: `Femgram #${id}`,
    artist: artistTags[0] || "R34 Vault",
    source: "R34 Vault",
    sourceUrl: `${ROOT}/post/${id}`,
    thumbnail: type === "image" ? media : videoPoster(),
    media,
    tags: [...new Set(["femgram", "rule34vault", ...tags])].slice(0, 12),
    likes: Number(post.favorites || post.favoriteCount || 0),
    date: post.created || new Date().toISOString(),
    mature: true,
    rights: "See original R34 Vault page and its terms"
  };
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

async function collectFromApi(){
  const items = [];
  let skip = 0;
  let cursor = "";

  for(let page = 0; page < MAX_PAGES; page++){
    const body = {
      includeTags: ["femgram"],
      CountTotal: false,
      Skip: skip,
      take: PAGE_SIZE
    };
    if(cursor) body.cursor = cursor;

    const response = await fetch(API, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "user-agent": "FemgramHub/0.1 (public source collector)"
      },
      body: JSON.stringify(body)
    });

    if(!response.ok) throw new Error(`API HTTP ${response.status}`);

    const data = await response.json();
    const pageItems = Array.isArray(data.items) ? data.items : [];
    items.push(...pageItems.map(mapApiPost).filter(Boolean));

    console.log(`R34 Vault API page ${page + 1}: ${pageItems.length} raw / ${items.length} usable`);

    if(pageItems.length < PAGE_SIZE) break;

    cursor = data.cursor || "";
    skip += PAGE_SIZE;

    await new Promise(r => setTimeout(r, 500));
  }

  return items;
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

  if(mediaVideo) return {type:"video", media:mediaVideo, thumbnail:mediaImage || videoPoster()};
  if(mediaImage) return {type:"image", media:mediaImage, thumbnail:mediaImage};
  return null;
}

async function collectFromHtml(){
  const html = await fetchText(TAG_URL);
  const urls = [...html.matchAll(/href=["'](\/post\/\d+)["']/gi)]
    .map(m => `${ROOT}${m[1]}`)
    .filter((url, index, list) => list.indexOf(url) === index)
    .slice(0, PAGE_SIZE);

  const items = [];

  for(const url of urls){
    try{
      const postHtml = await fetchText(url);
      const text = strip(postHtml);
      if(isForbiddenTagText([text])) continue;

      const found = extractMedia(postHtml);
      const id = url.match(/\/post\/(\d+)/)?.[1];
      if(!found || !id) continue;

      items.push({
        id: `rule34vault-${id}`,
        type: found.type,
        title: titleFromPost(postHtml, id),
        artist: "R34 Vault",
        source: "R34 Vault",
        sourceUrl: url,
        thumbnail: found.thumbnail,
        media: found.media,
        tags: ["femgram", "rule34vault"],
        likes: 0,
        date: meta(postHtml, "article:published_time") || new Date().toISOString(),
        mature: true,
        rights: "See original R34 Vault page and its terms"
      });
    }catch(error){
      console.warn(`R34 Vault HTML fallback skipped ${url}: ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 450));
  }

  return items;
}

async function main(){
  const existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  const merged = new Map(existing.map(item => [item.id, item]));

  let items;
  try{
    items = await collectFromApi();
    console.log(`R34 Vault API returned ${items.length} usable Femgram records.`);
  }catch(error){
    console.warn(`R34 Vault API unavailable: ${error.message}`);
    items = await collectFromHtml();
    console.log(`R34 Vault HTML fallback returned ${items.length} usable records.`);
  }

  let added = 0;
  for(const item of items){
    if(!merged.has(item.id)) added++;
    merged.set(item.id, item);
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`R34 Vault added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
