#!/usr/bin/env node
import fs from "node:fs/promises";

const API = "https://commons.wikimedia.org/w/api.php";
const OUTPUT = "data/media.json";
const QUERIES = [
  "femgram",
  "femgram geometry dash",
  "femgram art"
];

function escHtml(value=""){
  return String(value).replace(/<[^>]*>/g, "").trim();
}

async function search(query){
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "50",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "900",
    format: "json",
    formatversion: "2"
  });

  const response = await fetch(`${API}?${params.toString()}`, {
    headers: {
      "accept": "application/json",
      "user-agent": "FemgramHub/0.1 (Wikimedia Commons catalogue collector)"
    }
  });

  if(!response.ok) throw new Error(`Wikimedia HTTP ${response.status}`);
  const data = await response.json();

  return (data.query?.pages || []).flatMap(page => {
    const info = page.imageinfo?.[0];
    if(!info || !String(info.mime || "").startsWith("image/")) return [];

    const meta = info.extmetadata || {};
    const title = String(page.title || "").replace(/^File:/, "");
    const creator = escHtml(meta.Artist?.value || meta.Credit?.value || "Wikimedia Commons");
    const license = escHtml(meta.LicenseShortName?.value || meta.License?.value || "See source");
    const description = escHtml(meta.ImageDescription?.value || "");

    return [{
      id: `wikimedia-${page.pageid}`,
      type: "image",
      title: title.slice(0, 120) || "Femgram",
      artist: creator.slice(0, 120),
      source: "Wikimedia Commons",
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title).replace(/%3A/g, ":")}`,
      thumbnail: info.thumburl || info.url,
      media: info.url,
      tags: ["femgram","wikimedia",...(description ? description.split(/[,;\n]/).slice(0,2) : [])],
      likes: 0,
      date: meta.DateTimeOriginal?.value || new Date().toISOString(),
      rights: license
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
      console.log(`Wikimedia "${query}" -> ${items.length}`);
    }catch(error){
      console.warn(`Wikimedia skipped "${query}": ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 700));
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wikimedia added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
