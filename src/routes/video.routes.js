const { Router } = require("express");
const videos = require("../controllers/video.controller");

const router = Router();

/* ----------------------------- Public ---------------------------------- */
router.get("/videos/playlists", videos.listPlaylists);
router.get("/videos/playlists/:id/videos", videos.listPlaylistVideos);

module.exports = router;
