#!/usr/bin/env node
import fs from "node:fs/promises";

const API = "https://api.openverse.org/v1/images/";
const OUTPUT = "data/media.json";
const QUERIES = [
  "femgram",
  "femgram geometry dash",
  "femgram art",
  "femgram bunny girl"
];

async function fetchJson(url){
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "FemgramHub/0.1 (open media catalogue collector)"
    }
  });
  if(!response.ok) throw new Error(`Openverse HTTP ${response.status}`);
  return response.json();
}

function mapResult(item){
  const media = item.url || "";
  const thumbnail = item.thumbnail || media;
  if(!media || !thumbnail) return null;

  return {
    id: `openverse-${item.id}`,
    type: "image",
    title: item.title || "Femgram",
    artist: item.creator || "Unknown creator",
    source: item.provider || item.source || "Openverse",
    sourceUrl: item.foreign_landing_url || item.detail_url || "https://openverse.org/",
    thumbnail,
    media,
    tags: ["femgram","openverse",...(item.tags || []).slice(0,4).map(t => String(t))],
    likes: 0,
    date: item.indexed_on || new Date().toISOString(),
    rights: item.license ? `${item.license}${item.license_version ? ` ${item.license_version}` : ""}` : "Open license; see source"
  };
}

async function search(query){
  const results = [];
  for(let page = 1; page <= 3; page++){
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      page_size: "50",
      mature: "false",
      filter_dead: "true"
    });

    const data = await fetchJson(`${API}?${params.toString()}`);
    const rows = Array.isArray(data.results) ? data.results : [];
    results.push(...rows.map(mapResult).filter(Boolean));

    if(page >= Number(data.page_count || page) || !rows.length) break;
    await new Promise(r => setTimeout(r, 800));
  }
  return results;
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
      console.log(`Openverse "${query}" -> ${items.length}`);
    }catch(error){
      console.warn(`Openverse skipped "${query}": ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 900));
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`Openverse added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
