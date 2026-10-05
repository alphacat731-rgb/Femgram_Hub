#!/usr/bin/env node

const fs = require("node:fs/promises");

const API = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const OUTPUT = "data/media.json";
const QUERIES = [
  "femgram",
  "Femgram",
  "femgram geometry dash"
];
const PAGES_PER_QUERY = 5;
const PAGE_LIMIT = 100;

function isRestricted(post){
  const labels = [
    ...(post.labels || []),
    ...(post.author?.labels || [])
  ].map(label => String(label.val || label.value || "").toLowerCase());

  return labels.some(label =>
    ["porn","sexual","nudity","nsfw","graphic-media"].includes(label)
  );
}

function postUrl(post){
  const handle = post.author?.handle || post.author?.displayName || post.author?.did;
  const rkey = String(post.uri || "").split("/").pop();
  return rkey && handle
    ? `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${rkey}`
    : "https://bsky.app/";
}

function firstLine(text){
  return String(text || "").split(/\r?\n/)[0].trim().slice(0, 100) || "Femgram";
}

function mapPost(post){
  if(isRestricted(post)) return [];

  const embed = post.embed || {};
  const type = String(embed.$type || "");

  if(type.includes("app.bsky.embed.images#view") && Array.isArray(embed.images)){
    return embed.images.map((image, index) => {
      const media = image.fullsize || image.thumb;
      if(!media) return null;

      return {
        id: `bsky-${post.cid}-${index}`,
        type: "image",
        title: firstLine(post.record?.text),
        artist: post.author?.handle || post.author?.displayName || "bluesky",
        source: "Bluesky",
        sourceUrl: postUrl(post),
        thumbnail: image.thumb || media,
        media,
        tags: ["femgram","bluesky"],
        likes: Number(post.likeCount || 0),
        date: post.record?.createdAt || post.indexedAt || new Date().toISOString(),
        rights: "See original post"
      };
    }).filter(Boolean);
  }

  if(type.includes("app.bsky.embed.video#view") && embed.thumbnail){
    return [{
      id: `bsky-video-${post.cid}`,
      type: "video",
      title: firstLine(post.record?.text),
      artist: post.author?.handle || post.author?.displayName || "bluesky",
      source: "Bluesky",
      sourceUrl: postUrl(post),
      thumbnail: embed.thumbnail,
      media: embed.playlist || embed.thumbnail,
      tags: ["femgram","bluesky","video"],
      likes: Number(post.likeCount || 0),
      date: post.record?.createdAt || post.indexedAt || new Date().toISOString(),
      rights: "See original post"
    }];
  }

  return [];
}

async function search(query){
  const items = [];
  let cursor = "";

  for(let page = 0; page < PAGES_PER_QUERY; page++){
    const params = new URLSearchParams({
      q: query,
      limit: String(PAGE_LIMIT)
    });

    if(cursor) params.set("cursor", cursor);

    const response = await fetch(`${API}?${params.toString()}`);
    if(!response.ok){
      throw new Error(`Bluesky HTTP ${response.status} for "${query}"`);
    }

    const data = await response.json();
    for(const post of data.posts || []) items.push(...mapPost(post));

    if(!data.cursor || !(data.posts || []).length) break;
    cursor = data.cursor;
  }

  return items;
}

async function main(){
  const existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  const merged = new Map(existing.map(item => [item.id, item]));

  let fetched = 0;
  for(const query of QUERIES){
    const items = await search(query);
    fetched += items.length;
    for(const item of items) merged.set(item.id, item);
  }

  const output = [...merged.values()].sort(
    (a,b) => new Date(b.date) - new Date(a.date)
  );

  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");

  console.log(`Fetched ${fetched} live media records; catalogue now has ${output.length} unique records.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
