#!/usr/bin/env node
import fs from "node:fs/promises";

const API = "https://www.reddit.com/search.json";
const OUTPUT = "data/media.json";
const QUERIES = [
  "femgram",
  ""femgram" geometry dash"
];

function cleanUrl(url=""){
  return String(url).replace(/&amp;/g, "&");
}

function isBlocked(post){
  const text = `${post.title || ""} ${post.selftext || ""}`.toLowerCase();
  return Boolean(
    post.over_18 ||
    post.spoiler ||
    /\b(child|minor|underage|loli|shota)\b/i.test(text)
  );
}

async function search(query){
  const params = new URLSearchParams({
    q: query,
    sort: "new",
    limit: "100",
    raw_json: "1",
    type: "link"
  });

  const response = await fetch(`${API}?${params.toString()}`, {
    headers: {
      "accept": "application/json",
      "user-agent": "FemgramHub/0.1 (Reddit public-feed collector)"
    }
  });

  if(!response.ok) throw new Error(`Reddit HTTP ${response.status}`);
  const data = await response.json();
  const posts = data.data?.children?.map(x => x.data).filter(Boolean) || [];

  return posts.filter(post => !isBlocked(post)).flatMap(post => {
    const preview = post.preview?.images?.[0];
    const previewUrl = cleanUrl(preview?.source?.url || "");
    const thumbUrl = cleanUrl(preview?.resolutions?.[0]?.url || previewUrl);
    const destination = cleanUrl(post.url_overridden_by_dest || post.url || "");

    const redditVideo = post.secure_media?.reddit_video?.fallback_url || "";
    if(redditVideo){
      return [{
        id: `reddit-video-${post.id}`,
        type: "video",
        title: post.title || "Femgram video",
        artist: post.author ? `u/${post.author}` : "Reddit",
        source: "Reddit",
        sourceUrl: `https://www.reddit.com${post.permalink || ""}`,
        thumbnail: thumbUrl || previewUrl,
        media: redditVideo,
        tags: ["femgram","reddit","video"],
        likes: Number(post.score || 0),
        date: new Date(Number(post.created_utc || 0) * 1000).toISOString(),
        rights: "See original Reddit post"
      }];
    }

    const looksImage = /\.(?:jpe?g|png|gif|webp)(?:\?|$)/i.test(destination) || Boolean(previewUrl);
    if(!looksImage || !previewUrl) return [];

    return [{
      id: `reddit-${post.id}`,
      type: /\.gif(?:\?|$)/i.test(destination) ? "gif" : "image",
      title: post.title || "Femgram",
      artist: post.author ? `u/${post.author}` : "Reddit",
      source: "Reddit",
      sourceUrl: `https://www.reddit.com${post.permalink || ""}`,
      thumbnail: thumbUrl || previewUrl,
      media: previewUrl,
      tags: ["femgram","reddit"],
      likes: Number(post.score || 0),
      date: new Date(Number(post.created_utc || 0) * 1000).toISOString(),
      rights: "See original Reddit post"
    }];
  });
}

async function main(){
  const existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  const merged = new Map(existing.map(item => [item.id, item]));
  let added = 0;

  for(const query of QUERIES){
    try{
      const items = await search(query);
      for(const item of items){
        if(!merged.has(item.id)) added++;
        merged.set(item.id, item);
      }
      console.log(`Reddit "${query}" -> ${items.length}`);
    }catch(error){
      console.warn(`Reddit skipped "${query}": ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`Reddit added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
