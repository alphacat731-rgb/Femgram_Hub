const state = {
  items: [],
  type: "all",
  sort: "new",
  likedOnly: false,
  savedOnly: false,
  query: "",
  current: null,
  liked: new Set(JSON.parse(localStorage.getItem("femgram-liked") || "[]")),
  saved: new Set(JSON.parse(localStorage.getItem("femgram-saved") || "[]")),
  visibleCount: 36,
  loadingMore: false
};

const $ = (s) => document.querySelector(s);
const gallery = $("#gallery");
const emptyState = $("#emptyState");
const modal = $("#modal");

function persist(){
  localStorage.setItem("femgram-liked", JSON.stringify([...state.liked]));
  localStorage.setItem("femgram-saved", JSON.stringify([...state.saved]));
  $("#savedCount").textContent = state.saved.size;
}

function esc(value=""){
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function filtered(){
  const q = state.query.trim().toLowerCase();
  return state.items
    .filter(i => state.type === "all" || i.type === state.type)
    .filter(i => !state.likedOnly || state.liked.has(i.id))
    .filter(i => !state.savedOnly || state.saved.has(i.id))
    .filter(i => !q || [i.title,i.artist,i.source,...(i.tags||[])].join(" ").toLowerCase().includes(q))
    .sort((a,b) => state.sort === "popular" ? (b.likes||0)-(a.likes||0) : new Date(b.date)-new Date(a.date));
}

function card(item){
  const liked = state.liked.has(item.id);
  const saved = state.saved.has(item.id);
  const typeLabel = item.type.toUpperCase();
  return `
    <article class="card" tabindex="0" data-id="${esc(item.id)}">
      <div class="thumb">
        <img class="thumb-art" src="${esc(item.thumbnail || item.media || "")}" alt="${esc(item.title)}" loading="lazy" decoding="async">
        <span class="badge">${typeLabel}</span>
        <div class="card-overlay">
          <button class="round-btn ${liked?'active':''}" data-action="like" aria-label="${liked?'Unlike':'Like'}">${liked?'♥':'♡'}</button>
          <button class="round-btn ${saved?'active':''}" data-action="save" aria-label="${saved?'Unsave':'Save'}">${saved?'🔖':'▫'}</button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(item.title)}</div>
        <div class="card-meta"><span>@${esc(item.artist)}</span><span>${esc(item.source)}</span></div>
        <div class="tag-row">${(item.tags||[]).slice(0,3).map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}</div>
      </div>
    </article>`;
}

function setLoadingMore(isLoading){
  state.loadingMore = isLoading;
  const loader = $("#loadMore");
  if(!loader) return;
  loader.setAttribute("aria-busy", String(isLoading));
  loader.classList.toggle("is-loading", isLoading);
}

function render(){
  const items = filtered();
  const visible = items.slice(0, state.visibleCount);

  gallery.innerHTML = visible.map(card).join("");
  emptyState.hidden = items.length > 0;

  $("#mediaCount").textContent = state.items.length;
  $("#sourceCount").textContent = new Set(state.items.map(i => i.source)).size;

  const loader = $("#loadMore");
  const loaderText = $("#loadMoreText");
  if(loader){
    const hasMore = visible.length < items.length;
    loader.hidden = !hasMore;
    loaderText.textContent = hasMore
      ? `Showing ${visible.length} of ${items.length} — more loads automatically`
      : "";
    if(!hasMore) setLoadingMore(false);
  }

  persist();
}

function resetView(){
  state.visibleCount = 36;
  setLoadingMore(false);
  render();
}

function loadMoreItems(){
  const items = filtered();
  if(state.loadingMore || state.visibleCount >= items.length) return;

  setLoadingMore(true);
  window.requestAnimationFrame(() => {
    state.visibleCount = Math.min(state.visibleCount + 36, items.length);
    render();
    setLoadingMore(false);
  });
}

function setActive(selector, value, attr="data-type"){
  document.querySelectorAll(selector).forEach(el => el.classList.toggle("active", el.getAttribute(attr) === value));
}

function openViewer(id){
  const item = state.items.find(i => i.id === id);
  if(!item) return;
  state.current = item;
  $("#viewerType").textContent = item.type.toUpperCase();
  $("#viewerTitle").textContent = item.title;
  $("#viewerMeta").textContent = `@${item.artist} • ${item.source} • ${new Date(item.date).toLocaleDateString()}`;
  $("#viewerTags").innerHTML = (item.tags||[]).map(t => `<span class="tag">#${esc(t)}</span>`).join("");
  $("#viewerSource").href = item.sourceUrl || "#";
  $("#viewerLike").textContent = state.liked.has(id) ? "♥ Liked" : "♥ Like";
  $("#viewerSave").textContent = state.saved.has(id) ? "🔖 Saved" : "🔖 Save";

  if(item.type === "video"){
    $("#viewerMedia").innerHTML = `<video src="${esc(item.media)}" poster="${esc(item.thumbnail)}" controls playsinline preload="metadata"></video>`;
  } else {
    $("#viewerMedia").innerHTML = `<img src="${esc(item.media || item.thumbnail)}" alt="${esc(item.title)}">`;
  }
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeViewer(){
  const video = $("#viewerMedia video");
  if(video) video.pause();
  $("#viewerMedia").innerHTML = "";
  modal.hidden = true;
  document.body.style.overflow = "";
  state.current = null;
}

function toggle(set, id){
  set.has(id) ? set.delete(id) : set.add(id);
  render();
  if(state.current?.id === id){
    $("#viewerLike").textContent = state.liked.has(id) ? "♥ Liked" : "♥ Like";
    $("#viewerSave").textContent = state.saved.has(id) ? "🔖 Saved" : "🔖 Save";
  }
}

function initInfiniteScroll(){
  const loader = $("#loadMore");
  const button = $("#loadMoreButton");
  if(!loader) return;

  button?.addEventListener("click", loadMoreItems);

  if("IntersectionObserver" in window){
    const observer = new IntersectionObserver(entries => {
      if(entries.some(entry => entry.isIntersecting)){
        loadMoreItems();
      }
    }, {rootMargin:"1200px 0px"});
    observer.observe(loader);
  }else{
    loader.classList.add("manual-fallback");
  }
}

function handleImageError(event){
  const img = event.target;
  if(!(img instanceof HTMLImageElement)) return;
  if(img.dataset.failed) return;

  img.dataset.failed = "1";
  img.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#0d0f16"/><text x="400" y="250" text-anchor="middle" fill="#9ea5b8" font-family="Arial, sans-serif" font-size="28">Preview unavailable</text></svg>'
  )}`;
}

function isRestricted(post){
  const labels = [
    ...(post.labels || []),
    ...(post.author?.labels || [])
  ].map(label => String(label.val || label.value || "").toLowerCase());
  return labels.some(label => ["porn","sexual","nudity","nsfw","graphic-media"].includes(label));
}

function blueskyPostUrl(post){
  const handle = post.author?.handle || post.author?.displayName || post.author?.did;
  const rkey = String(post.uri || "").split("/").pop();
  return rkey && handle ? `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${rkey}` : "https://bsky.app/";
}

function mapBlueskyPost(post){
  if(isRestricted(post)) return [];

  const embed = post.embed || {};
  const embedType = String(embed.$type || "");

  if(embedType.includes("app.bsky.embed.images#view") && Array.isArray(embed.images)){
    return embed.images.map((image, index) => {
      const direct = image.fullsize || image.thumb;
      if(!direct) return null;
      return {
        id: `bsky-${post.cid}-${index}`,
        type: "image",
        title: post.record?.text?.split("\\n")[0]?.slice(0, 80) || "Femgram",
        artist: post.author?.handle || post.author?.displayName || "bluesky",
        source: "Bluesky",
        sourceUrl: blueskyPostUrl(post),
        thumbnail: image.thumb || direct,
        media: direct,
        tags: ["femgram","bluesky"],
        likes: Number(post.likeCount || 0),
        date: post.record?.createdAt || post.indexedAt || new Date().toISOString(),
        rights: "See original post"
      };
    }).filter(Boolean);
  }

  if(embedType.includes("app.bsky.embed.video#view") && embed.thumbnail){
    return [{
      id: `bsky-video-${post.cid}`,
      type: "video",
      title: post.record?.text?.split("\\n")[0]?.slice(0, 80) || "Femgram video",
      artist: post.author?.handle || post.author?.displayName || "bluesky",
      source: "Bluesky",
      sourceUrl: blueskyPostUrl(post),
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

async function fetchBlueskyFemgram(){
  const results = [];
  let cursor = "";
  const maxPages = 4;

  for(let page = 0; page < maxPages; page++){
    const params = new URLSearchParams({q:"femgram",limit:"100"});
    if(cursor) params.set("cursor", cursor);

    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params.toString()}`,
      {headers:{accept:"application/json"}, cache:"no-store"}
    );
    if(!response.ok) throw new Error(`Bluesky search failed: HTTP ${response.status}`);

    const data = await response.json();
    results.push(...(data.posts || []).flatMap(mapBlueskyPost));
    cursor = data.cursor || "";
    if(!cursor || !(data.posts || []).length) break;
  }

  return results;
}

async function init(){
  try{
    const response = await fetch("./data/media.json", {cache:"no-store"});
    if(!response.ok) throw new Error("media.json could not be loaded");

    const seed = await response.json();
    state.items = Array.isArray(seed) ? seed.sort((a,b) => new Date(b.date) - new Date(a.date)) : [];

    $("#notice").hidden = false;
    $("#notice").textContent = `Catalogue: ${state.items.length} real source items across ${new Set(state.items.map(i => i.source)).size} sources. More items load automatically as you scroll.`;
    render();
  }catch(err){
    console.error(err);
    $("#notice").hidden = false;
    $("#notice").textContent = "Could not load the media catalogue. Check data/media.json.";
    render();
  }

  document.querySelectorAll("[data-type]").forEach(btn => btn.addEventListener("click", () => {
    state.type = btn.dataset.type;
    state.likedOnly = false;
    state.savedOnly = false;
    $("#likedBtn").classList.remove("active");
    setActive("[data-type]", state.type);
    resetView();
  }));

  document.querySelectorAll("[data-sort]").forEach(btn => btn.addEventListener("click", () => {
    state.sort = btn.dataset.sort;
    setActive("[data-sort]", state.sort, "data-sort");
    resetView();
  }));

  $("#likedBtn").addEventListener("click", () => {
    state.likedOnly = !state.likedOnly;
    state.savedOnly = false;
    $("#savedTopBtn").classList.remove("active");
    $("#likedBtn").classList.toggle("active", state.likedOnly);
    resetView();
  });

  $("#savedTopBtn").addEventListener("click", () => {
    state.savedOnly = !state.savedOnly;
    state.likedOnly = false;
    $("#likedBtn").classList.remove("active");
    $("#savedTopBtn").classList.toggle("active", state.savedOnly);
    resetView();
  });

  $("#searchInput").addEventListener("input", e => { state.query = e.target.value; resetView(); });

  initInfiniteScroll();

  window.addEventListener("keydown", e => {
    if(e.key === "/" && document.activeElement !== $("#searchInput")){ e.preventDefault(); $("#searchInput").focus(); }
    if(e.key === "Escape") closeViewer();
  });

  gallery.addEventListener("error", handleImageError, true);

  gallery.addEventListener("click", e => {
    const button = e.target.closest("[data-action]");
    const item = e.target.closest(".card");
    if(!item) return;
    const id = item.dataset.id;
    if(button){
      e.stopPropagation();
      if(button.dataset.action === "like") toggle(state.liked,id);
      if(button.dataset.action === "save") toggle(state.saved,id);
      return;
    }
    openViewer(id);
  });

  gallery.addEventListener("keydown", e => {
    if((e.key === "Enter" || e.key === " ") && e.target.closest(".card")){
      e.preventDefault(); openViewer(e.target.closest(".card").dataset.id);
    }
  });

  $("#closeModal").addEventListener("click", closeViewer);
  document.querySelector(".modal-backdrop").addEventListener("click", closeViewer);
  $("#viewerLike").addEventListener("click", ()=>state.current && toggle(state.liked,state.current.id));
  $("#viewerSave").addEventListener("click", ()=>state.current && toggle(state.saved,state.current.id));
  $("#clearFilters").addEventListener("click", () => {
    state.type="all";state.sort="new";state.likedOnly=false;state.savedOnly=false;state.query="";
    $("#searchInput").value="";$("#likedBtn").classList.remove("active");$("#savedTopBtn").classList.remove("active");
    setActive("[data-type]","all");setActive("[data-sort]","new","data-sort");resetView();
  });
}

const ageGate = $("#ageGate");
const hasAccepted = localStorage.getItem("femgram-age-ok") === "1";
if(!hasAccepted) ageGate.classList.add("open");
$("#enterBtn").addEventListener("click",()=>{localStorage.setItem("femgram-age-ok","1");ageGate.classList.remove("open")});
$("#leaveBtn").addEventListener("click",()=>{location.replace("about:blank")});
$("#themeBtn").addEventListener("click",()=>{
  document.documentElement.style.setProperty("--accent", getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() === "#ff5ca8" ? "#7dd3fc" : "#ff5ca8");
});

init();
