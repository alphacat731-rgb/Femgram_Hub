#!/usr/bin/env node
import fs from "node:fs/promises";

const OUTPUT = "data/media.json";
const INSTANCES = [
  "https://mastodon.social",
  "https://mastodon.art",
  "https://mastodon.online",
  "https://mstdn.social",
  "https://mastodon.games",
  "https://furry.engineering"
];
const TAGS = ["femgram", "femgramart", "femgramfanart"];

function cleanText(value=""){
  return String(value).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function unsafe(status){
  const text = cleanText(status.content || "");
  return Boolean(status.sensitive) ||
    /\b(child|minor|underage|loli|shota)\b/i.test(text);
}

function mapStatus(status, instance){
  if(unsafe(status)) return [];

  const account = status.account || {};
  const artist = account.acct || account.username || "Mastodon user";
  const sourceUrl = status.url || `${instance}/@${artist}/${status.id}`;
  const created = status.created_at || new Date().toISOString();

  return (status.media_attachments || []).flatMap((media, index) => {
    const url = media.url || media.remote_url || "";
    const preview = media.preview_url || url;
    if(!url || !preview) return [];

    const mime = String(media.type || "").toLowerCase();
    const type = mime === "gifv" ? "gif" :
      (mime === "video" || /video\//i.test(media.mime_type || "")) ? "video" : "image";

    return [{
      id: `mastodon-${instance.replace(/^https?:\/\//,"").replace(/[^a-z0-9]+/gi,"-")}-${status.id}-${index}`,
      type,
      title: cleanText(status.spoiler_text) || cleanText(status.content).slice(0, 100) || "Femgram",
      artist,
      source: "Mastodon",
      sourceUrl,
      thumbnail: preview,
      media: url,
      tags: ["femgram","mastodon",...(media.description ? [cleanText(media.description).slice(0,60)] : [])],
      likes: Number(status.favourites_count || 0),
      date: created,
      rights: "See original Mastodon post"
    }];
  });
}

async function fetchTag(instance, tag){
  const params = new URLSearchParams({
    only_media: "true",
    limit: "40"
  });

  const response = await fetch(
    `${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}?${params.toString()}`,
    {
      headers: {
        "accept": "application/json",
        "user-agent": "FemgramHub/0.1 (federated public-tag collector)"
      }
    }
  );

  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const statuses = await response.json();
  return Array.isArray(statuses) ? statuses.flatMap(status => mapStatus(status, instance)) : [];
}

async function main(){
  const existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  const merged = new Map(existing.map(item => [item.id, item]));
  let added = 0;
  let found = 0;

  for(const instance of INSTANCES){
    for(const tag of TAGS){
      try{
        const items = await fetchTag(instance, tag);
        found += items.length;
        for(const item of items){
          if(!merged.has(item.id)) added++;
          merged.set(item.id, item);
        }
        console.log(`${instance} #${tag} -> ${items.length}`);
      }catch(error){
        console.warn(`${instance} #${tag} skipped: ${error.message}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const output = [...merged.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`Mastodon found ${found}, added ${added}; catalogue now has ${output.length} items.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
