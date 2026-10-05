# Femgram Hub

A focused, source-aware gallery for discovering Femgram images, GIFs and videos.

## Current prototype

- Responsive masonry gallery
- Search across title, artist, source and tags
- Image / GIF / video filters
- Latest / popular sorting
- Local likes and saves via `localStorage`
- Full-screen viewer with source attribution
- Automatic infinite scroll in small batches, with a manual fallback
- 18+ entry gate
- JSON catalogue at `data/media.json`
- GitHub Actions → GitHub Pages deployment

The refresh pipeline supports Bluesky, Openverse, Wikimedia Commons, Reddit's public feed, Newgrounds' public art pages, DeviantArt oEmbed seeds, Mastodon public hashtag timelines, Tumblr public tag RSS, Flickr public photo feeds, and R34 Vault's public Femgram tag page. The R34 Vault collector uses the site's paginated public API when available (up to 5×100 records per refresh) and falls back to the public tag page when the API is unavailable. R34 Vault media stays hosted by the original source and every imported record keeps a source link. Collectors keep source attribution and can fail independently so one blocked/empty provider does not stop the rest of the refresh.

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

1. More source adapters using permitted public APIs, RSS feeds, oEmbed metadata, or other authorized endpoints.
2. Source-level pagination/cursors where providers expose them, plus broader coverage and deduplication by canonical URL/media identity.
3. Moderation metadata: mature flag, creator opt-out, takedown state, source-license notes, and collector provenance.
4. Optional backend for account-based likes/saves instead of browser-local storage.
