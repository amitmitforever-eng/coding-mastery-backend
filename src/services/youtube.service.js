const env = require("../config/env");
const { canonicalChannelUrl } = require("../utils/youtube");

const API_BASE = "https://www.googleapis.com/youtube/v3";

// Simple in-memory caches so we don't hammer the YouTube API (it has a daily
// quota). Playlists rarely change minute-to-minute, so a few minutes is fine.
// The playlist *list* and each playlist's *videos* are cached independently so
// we only fetch a playlist's videos when someone actually opens that tab.
const CACHE_TTL_MS = 10 * 60 * 1000;
let playlistsCache = { at: 0, data: null };
const videosCache = new Map(); // playlistId -> { at, videos }

/**
 * Accept a raw channel id ("UC..."), a full channel URL
 * ("https://www.youtube.com/channel/UC..."), or junk. Returns a clean channel
 * id if we can confidently extract one, otherwise null (so we fall back to
 * resolving from the handle).
 */
function normalizeChannelId(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/(UC[0-9A-Za-z_-]{20,})/);
  return match ? match[1] : null;
}

let resolvedChannelId = normalizeChannelId(env.youtube.channelId);

function isConfigured() {
  return Boolean(env.youtube.apiKey);
}

async function ytGet(path, params) {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set("key", env.youtube.apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      json && json.error && json.error.message
        ? json.error.message
        : `YouTube API request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Pick the largest available thumbnail for a snippet. */
function bestThumb(thumbnails) {
  if (!thumbnails) return null;
  return (
    thumbnails.maxres ||
    thumbnails.standard ||
    thumbnails.high ||
    thumbnails.medium ||
    thumbnails.default ||
    null
  )?.url ?? null;
}

/** Resolve the channel handle (e.g. "codingmasterybyamit") to a channel id. */
async function getChannelId() {
  if (resolvedChannelId) return resolvedChannelId;

  const handle = (env.youtube.channelHandle || "").replace(/^@/, "");
  if (!handle) {
    throw new Error("No YouTube channel handle or id configured.");
  }

  const data = await ytGet("channels", { part: "id", forHandle: handle });
  const id = data.items && data.items[0] && data.items[0].id;
  if (!id) {
    throw new Error(`Could not resolve YouTube channel for handle @${handle}.`);
  }
  resolvedChannelId = id;
  return id;
}

/** Fetch all playlists for the channel (paginated). */
async function fetchAllPlaylists(channelId) {
  const playlists = [];
  let pageToken;
  do {
    const data = await ytGet("playlists", {
      part: "snippet,contentDetails",
      channelId,
      maxResults: 50,
      pageToken,
    });
    for (const item of data.items || []) {
      playlists.push({
        id: item.id,
        title: item.snippet?.title ?? "Untitled playlist",
        description: item.snippet?.description ?? "",
        thumbnail: bestThumb(item.snippet?.thumbnails),
        itemCount: item.contentDetails?.itemCount ?? 0,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return playlists;
}

/** Fetch all videos within a single playlist (paginated). */
async function fetchPlaylistVideos(playlistId) {
  const videos = [];
  let pageToken;
  do {
    const data = await ytGet("playlistItems", {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: 50,
      pageToken,
    });
    for (const item of data.items || []) {
      const videoId =
        item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      // Skip private/deleted entries that have no usable title.
      const title = item.snippet?.title;
      if (!title || title === "Private video" || title === "Deleted video") {
        continue;
      }
      videos.push({
        id: videoId,
        title,
        thumbnail: bestThumb(item.snippet?.thumbnails),
        position: item.snippet?.position ?? videos.length,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  videos.sort((a, b) => a.position - b.position);
  return videos;
}

/**
 * Return the channel's playlists as lightweight metadata only (id, title,
 * description, thumbnail, itemCount) — NO videos. Videos are loaded lazily per
 * playlist via getPlaylistVideos(). Every playlist is included, even empty
 * ones, so the frontend can render them all as tabs. Cached for a few minutes.
 */
async function getChannelPlaylists({ force = false } = {}) {
  if (!isConfigured()) {
    return {
      configured: false,
      channelUrl: canonicalChannelUrl(env.youtube.channelUrl),
      playlists: [],
    };
  }

  const fresh =
    playlistsCache.data && Date.now() - playlistsCache.at < CACHE_TTL_MS;
  if (fresh && !force) return playlistsCache.data;

  const channelId = await getChannelId();
  const playlists = await fetchAllPlaylists(channelId);

  const result = {
    configured: true,
    channelUrl: canonicalChannelUrl(env.youtube.channelUrl),
    playlists,
  };

  playlistsCache = { at: Date.now(), data: result };
  return result;
}

/**
 * Return the videos for a single playlist, loaded on demand and cached
 * per-playlist. This is what powers lazy-loading: a playlist's videos are only
 * fetched from YouTube the first time someone opens that tab.
 */
async function getPlaylistVideos(playlistId, { force = false } = {}) {
  if (!isConfigured()) {
    return { configured: false, videos: [] };
  }
  if (!playlistId) {
    const err = new Error("Playlist id is required.");
    err.status = 400;
    throw err;
  }

  const cached = videosCache.get(playlistId);
  const fresh = cached && Date.now() - cached.at < CACHE_TTL_MS;
  if (fresh && !force) return { configured: true, videos: cached.videos };

  const videos = await fetchPlaylistVideos(playlistId);
  videosCache.set(playlistId, { at: Date.now(), videos });
  return { configured: true, videos };
}

module.exports = { isConfigured, getChannelPlaylists, getPlaylistVideos };
