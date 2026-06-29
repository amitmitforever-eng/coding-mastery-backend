const YouTubeService = require("../services/youtube.service");

function wantsRefresh(req) {
  return req.query.refresh === "1" || req.query.refresh === "true";
}

/** Public: list all channel playlists (metadata only) for the Videos page. */
async function listPlaylists(req, res, next) {
  try {
    const data = await YouTubeService.getChannelPlaylists({
      force: wantsRefresh(req),
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/** Public: lazily load the videos for one playlist (loaded when a tab opens). */
async function listPlaylistVideos(req, res, next) {
  try {
    const data = await YouTubeService.getPlaylistVideos(req.params.id, {
      force: wantsRefresh(req),
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { listPlaylists, listPlaylistVideos };
