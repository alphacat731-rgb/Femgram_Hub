#!/usr/bin/env node
import fs from "node:fs/promises";

const OUTPUT = "data/media.json";
const SEEDS = "data/deviantart-seeds.json";
const OEMBED = "https://backend.deviantart.com/oembed";

async function fetchJson(url){
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "FemgramHub/0.1 (DeviantArt oEmbed collector)",
      "accept-encoding": "gzip, deflate, br"
    }
  });
  if(!response.ok) throw new Error(`DeviantArt oEmbed HTTP ${response.status}`);
  return response.json();
}

async function main(){
  const urls = JSON.parse(await fs.readFile(SEEDS, "utf8"));
  const existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  const merged = new Map(existing.map(item => [item.id, item]));
  let added = 0;

  for(const sourceUrl of urls){
    try{
      const params = new URLSearchParams({
        url: sourceUrl,
        format: "json"
      });
      const data = await fetchJson(`${OEMBED}?${params.toString()}`);

      if(data.type && data.type !== "photo" && data.type !== "image") continue;
      const media = data.url || data.thumbnail_url;
      if(!media) continue;

      const idMatch = sourceUrl.match(/(\d+)(?:\/?$)/);
      const id = `deviantart-${idMatch?.[1] || Buffer.from(sourceUrl).toString("base64url").slice(0,50)}`;

      const item = {
        id,
        type: "image",
        title: data.title || "Femgram",
        artist: data.author_name || "DeviantArt artist",
        source: "DeviantArt",
        sourceUrl,
        thumbnail: data.thumbnail_url || media,
        media,
        tags: ["femgram","deviantart"],
        likes: 0,
        date: new Date().toISOString(),
        rights: "See original DeviantArt page"
      };

      if(!merged.has(id)) added++;
      merged.set(id, item);
      console.log(`DeviantArt -> ${item.title}`);
    }catch(error){
      console.warn(`DeviantArt skipped ${sourceUrl}: ${error.message}`);
    }

    await new Promise(r => setTimeout(r, 700));
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`DeviantArt added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
