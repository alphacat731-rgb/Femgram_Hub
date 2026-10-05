# Femgram Hub

A focused, source-aware gallery for discovering Femgram images, GIFs and videos.

## Current prototype

- Responsive masonry gallery
- Search across title, artist, source and tags
- Image / GIF / video filters
- Latest / popular sorting
- Local likes and saves via `localStorage`
- Full-screen viewer with source attribution
- 18+ entry gate for future adult-tagged catalogue support
- JSON catalogue at `data/media.json`
- GitHub Actions → GitHub Pages deployment

The catalogue is now populated by multiple source collectors. The current refresh pipeline includes Bluesky, Openverse, Wikimedia Commons, Reddit's public feed, Newgrounds' public art pages, DeviantArt oEmbed seeds, Mastodon public hashtag timelines, Tumblr public tag RSS, and Flickr public photo feeds. Collectors are source-aware and keep creator/source attribution; collectors that fail are isolated so the rest of the catalogue can still refresh.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. GitHub's current Pages workflow uses `actions/checkout@v6`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, and `actions/deploy-pages@v4`.

In **Settings → Pages**, select **GitHub Actions** as the publishing source.

The repository is a public GitHub Pages project, so do not store restricted or sensitive media in the repo. For adult material, use hosting that permits that content and have the catalogue point at authorized external media instead.

## Media record format

Each item in `data/media.json` can look like:

```json
{
  "id": "unique-id",
  "type": "image",
  "title": "Post title",
  "artist": "creator",
  "source": "Platform",
  "sourceUrl": "https://example.com/post",
  "thumbnail": "https://example.com/thumb.jpg",
  "media": "https://example.com/full.jpg",
  "tags": ["femgram", "art"],
  "likes": 0,
  "date": "2026-10-04"
}
```

## Next build targets

1. Additional source adapters using permitted public APIs, RSS feeds, oEmbed metadata, or other authorized endpoints; source-specific licensing and opt-out checks should remain enabled.
2. Deduplication by canonical source URL and media hash, plus resilient retry/backoff handling.
3. Moderation metadata: mature flag, creator opt-out, takedown state, source-license notes, and collector provenance.
4. Optional backend for account-based likes/saves instead of browser-local storage.
5. Infinite scroll / pagination once the catalogue is large.
