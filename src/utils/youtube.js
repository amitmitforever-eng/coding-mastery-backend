/** Official Coding Mastery YouTube channel — single source of truth (backend). */
const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@codingmasterywithamit";
const YOUTUBE_CHANNEL_HANDLE = "codingmasterywithamit";

/** Old handles that should redirect to the canonical channel URL. */
const LEGACY_CHANNEL_HANDLES = [
  "codingmasterybyamit",
  "codemasterybyamit",
  "codingimprove",
];

/**
 * Normalize a YouTube channel / playlist URL. Rewrites known legacy channel
 * handles to the canonical @codingmasterywithamit URL.
 */
function normalizeYoutubeUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  for (const handle of LEGACY_CHANNEL_HANDLES) {
    if (lower.includes(`@${handle}`) || lower.includes(`youtube.com/${handle}`)) {
      return YOUTUBE_CHANNEL_URL;
    }
  }
  return trimmed;
}

/** Channel URL for API responses — always canonical. */
function canonicalChannelUrl(url) {
  return normalizeYoutubeUrl(url) || YOUTUBE_CHANNEL_URL;
}

module.exports = {
  YOUTUBE_CHANNEL_URL,
  YOUTUBE_CHANNEL_HANDLE,
  normalizeYoutubeUrl,
  canonicalChannelUrl,
};
