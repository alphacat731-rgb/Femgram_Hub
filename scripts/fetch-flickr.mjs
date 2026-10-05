#!/usr/bin/env node
import fs from "node:fs/promises";

const OUTPUT = "data/media.json";
const TAGS = [
  "femgram",
  "femgramart",
  "femgramfanart",
  "geometrydash,femgram"
];

function strip(value=""){
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function blocked(text){
  return /\b(child|minor|underage|loli|shota)\b/i.test(text) ||
         /\b(?:nsfw|explicit|sexual|nudity)\b/i.test(text);
}

function itemsFromJson(data){
  return (data.items || []).flatMap(item => {
    const raw = [item.title, item.description, item.tags].map(strip).join(" ");
    if(blocked(raw)) return [];

    const media = item.media?.m || "";
    if(!media) return [];

    return [{
      id: `flickr-${item.link || media}`,
      type: "image",
      title: strip(item.title) || "Femgram",
      artist: strip(item.author) || "Flickr creator",
      source: "Flickr",
      sourceUrl: item.link || "https://www.flickr.com/",
      thumbnail: media.replace(/_m\.(jpe?g|png|gif)$/i, ".$1"),
      media,
      tags: ["femgram","flickr",...strip(item.tags).split(/\s+/).filter(Boolean).slice(0,4)],
      likes: 0,
      date: item.date_taken || item.published || new Date().toISOString(),
      rights: "See original Flickr page"
    }];
  });
}

async function search(tag){
  const params = new URLSearchParams({
    tags: tag,
    tagmode: "any",
    format: "json",
    nojsoncallback: "1"
  });

  const response = await fetch(
    `https://www.flickr.com/services/feeds/photos_public.gne?${params.toString()}`,
    {
      headers: {
        "accept": "application/json",
        "user-agent": "FemgramHub/0.1 (Flickr public-feed collector)"
      }
    }
  );

  if(!response.ok) throw new Error(`Flickr HTTP ${response.status}`);
  return itemsFromJson(await response.json());
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
      console.log(`Flickr "${tag}" -> ${items.length}`);
    }catch(error){
      console.warn(`Flickr "${tag}" skipped: ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 800));
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`Flickr added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
