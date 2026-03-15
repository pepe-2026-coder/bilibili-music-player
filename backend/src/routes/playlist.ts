import { Router } from "express";
import db from "../models/database";

const router = Router();

/**
 * 获取所有歌单
 * GET /api/playlist
 */
router.get("/", (req, res) => {
  try {
    const playlists = db
      .prepare(
        `
      SELECT p.*, COUNT(ps.song_id) as song_count,
             (SELECT s.cover FROM songs s 
              JOIN playlist_songs ps ON s.id = ps.song_id 
              WHERE ps.playlist_id = p.id 
              ORDER BY ps.order_index LIMIT 1) as first_song_cover
      FROM playlists p 
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id 
      GROUP BY p.id 
      ORDER BY p.updated_at DESC
    `
      )
      .all();

    // 如果歌单没有封面，使用第一首歌曲的封面
    const playlistsWithCover = playlists.map((playlist: any) => {
      if (!playlist.cover && playlist.first_song_cover) {
        return { ...playlist, cover: playlist.first_song_cover };
      }
      return playlist;
    });

    res.json({
      code: 0,
      message: "success",
      data: playlistsWithCover,
    });
  } catch (error: any) {
    console.error("获取歌单失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取歌单失败",
      data: null,
    });
  }
});

/**
 * 获取单个歌单详情
 * GET /api/playlist/:id
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;

    const playlist = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id);
    if (!playlist) {
      return res.status(404).json({
        code: 404,
        message: "歌单不存在",
        data: null,
      });
    }

    const songs = db
      .prepare(
        `
      SELECT s.*, ps.order_index 
      FROM songs s 
      JOIN playlist_songs ps ON s.id = ps.song_id 
      WHERE ps.playlist_id = ? 
      ORDER BY ps.order_index
    `
      )
      .all(id);

    // 如果歌单没有封面且有歌曲，使用第一首歌曲的封面
    let playlistData: any = { ...playlist };
    if (!playlistData.cover && songs.length > 0) {
      playlistData.cover = (songs[0] as any).cover;
    }

    res.json({
      code: 0,
      message: "success",
      data: {
        ...playlistData,
        songs,
      },
    });
  } catch (error: any) {
    console.error("获取歌单详情失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取歌单详情失败",
      data: null,
    });
  }
});

/**
 * 创建歌单
 * POST /api/playlist
 */
router.post("/", (req, res) => {
  try {
    const { name, description, cover } = req.body;

    if (!name) {
      return res.status(400).json({
        code: 400,
        message: "歌单名称不能为空",
        data: null,
      });
    }

    const user = db
      .prepare("SELECT id FROM users ORDER BY created_at DESC LIMIT 1")
      .get() as any;

    const result = db
      .prepare(
        `
      INSERT INTO playlists (user_id, name, description, cover) 
      VALUES (?, ?, ?, ?)
    `
      )
      .run(user?.id || null, name, description || "", cover || "");

    const playlist = db
      .prepare("SELECT * FROM playlists WHERE id = ?")
      .get(result.lastInsertRowid);

    res.json({
      code: 0,
      message: "创建成功",
      data: playlist,
    });
  } catch (error: any) {
    console.error("创建歌单失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "创建歌单失败",
      data: null,
    });
  }
});

/**
 * 更新歌单
 * PUT /api/playlist/:id
 */
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, cover } = req.body;

    const playlist = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id);
    if (!playlist) {
      return res.status(404).json({
        code: 404,
        message: "歌单不存在",
        data: null,
      });
    }

    db.prepare(
      `
      UPDATE playlists 
      SET name = ?, description = ?, cover = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `
    ).run(
      name || (playlist as any).name,
      description !== undefined ? description : (playlist as any).description,
      cover !== undefined ? cover : (playlist as any).cover,
      id
    );

    const updated = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id);

    res.json({
      code: 0,
      message: "更新成功",
      data: updated,
    });
  } catch (error: any) {
    console.error("更新歌单失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "更新歌单失败",
      data: null,
    });
  }
});

/**
 * 删除歌单
 * DELETE /api/playlist/:id
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;

    const playlist = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id);
    if (!playlist) {
      return res.status(404).json({
        code: 404,
        message: "歌单不存在",
        data: null,
      });
    }

    db.prepare("DELETE FROM playlists WHERE id = ?").run(id);

    res.json({
      code: 0,
      message: "删除成功",
      data: null,
    });
  } catch (error: any) {
    console.error("删除歌单失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "删除歌单失败",
      data: null,
    });
  }
});

/**
 * 添加歌曲到歌单
 * POST /api/playlist/:id/songs
 */
router.post("/:id/songs", (req, res) => {
  try {
    const { id } = req.params;
    const { bvid, cid, title, artist, duration, cover } = req.body;

    if (!bvid || !title) {
      return res.status(400).json({
        code: 400,
        message: "缺少必要参数",
        data: null,
      });
    }

    const playlist = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id);
    if (!playlist) {
      return res.status(404).json({
        code: 404,
        message: "歌单不存在",
        data: null,
      });
    }

    // 检查歌曲是否已存在
    let song = db
      .prepare("SELECT * FROM songs WHERE bvid = ? AND cid = ?")
      .get(bvid, cid || "") as any;

    if (!song) {
      // 创建新歌曲记录
      const result = db
        .prepare(
          `
        INSERT INTO songs (bvid, cid, title, artist, duration, cover) 
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(bvid, cid || "", title, artist || "", duration || 0, cover || "");

      song = db
        .prepare("SELECT * FROM songs WHERE id = ?")
        .get(result.lastInsertRowid);
    }

    // 检查歌曲是否已在歌单中
    const existing = db
      .prepare(
        "SELECT * FROM playlist_songs WHERE playlist_id = ? AND song_id = ?"
      )
      .get(id, (song as any).id);

    if (existing) {
      return res.status(400).json({
        code: 400,
        message: "歌曲已在歌单中",
        data: null,
      });
    }

    // 获取当前最大 order_index
    const maxOrder =
      (
        db
          .prepare(
            "SELECT MAX(order_index) as max_order FROM playlist_songs WHERE playlist_id = ?"
          )
          .get(id) as any
      )?.max_order || 0;

    // 添加到歌单
    db.prepare(
      `
      INSERT INTO playlist_songs (playlist_id, song_id, order_index) 
      VALUES (?, ?, ?)
    `
    ).run(id, (song as any).id, maxOrder + 1);

    // 更新歌单更新时间
    db.prepare(
      "UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(id);

    res.json({
      code: 0,
      message: "添加成功",
      data: song,
    });
  } catch (error: any) {
    console.error("添加歌曲失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "添加歌曲失败",
      data: null,
    });
  }
});

/**
 * 从歌单移除歌曲
 * DELETE /api/playlist/:id/songs/:songId
 */
router.delete("/:id/songs/:songId", (req, res) => {
  try {
    const { id, songId } = req.params;

    db.prepare(
      "DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?"
    ).run(id, songId);

    // 更新歌单更新时间
    db.prepare(
      "UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(id);

    res.json({
      code: 0,
      message: "移除成功",
      data: null,
    });
  } catch (error: any) {
    console.error("移除歌曲失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "移除歌曲失败",
      data: null,
    });
  }
});

export default router;
