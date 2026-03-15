import { Router } from "express";
import { getVideoStream } from "../services/bilibili";
import db from "../models/database";

const router = Router();

/**
 * 获取视频流地址
 * GET /api/video/:bvid/stream?cid=xxx
 */
router.get("/:bvid/stream", async (req, res) => {
  try {
    const { bvid } = req.params;
    const { cid } = req.query;

    if (!cid || typeof cid !== "string") {
      return res.status(400).json({
        code: 400,
        message: "缺少 cid 参数",
        data: null,
      });
    }

    // 获取当前用户的 sessdata（如果有）
    const user = db
      .prepare("SELECT sessdata FROM users ORDER BY created_at DESC LIMIT 1")
      .get() as any;

    const result = await getVideoStream(bvid, cid, user?.sessdata);

    // 提取音频流地址（DASH 格式）
    let audioUrl = null;
    let videoUrl = null;

    if (result.dash) {
      // 获取最高质量的音频
      const audioStreams = result.dash.audio || [];
      if (audioStreams.length > 0) {
        // 按码率排序，取最高的
        audioStreams.sort((a: any, b: any) => b.bandwidth - a.bandwidth);
        audioUrl = audioStreams[0].baseUrl;
      }

      // 获取最高质量的视频
      const videoStreams = result.dash.video || [];
      if (videoStreams.length > 0) {
        // 按清晰度排序
        videoStreams.sort((a: any, b: any) => b.id - a.id);
        videoUrl = videoStreams[0].baseUrl;
      }
    }

    res.json({
      code: 0,
      message: "success",
      data: {
        audioUrl,
        videoUrl,
        format: result.format,
        quality: result.quality,
        timelength: result.timelength,
        // 判断是否为视频内容（有时长且视频流存在）
        isVideo: result.timelength > 0 && !!videoUrl,
        cacheKey: `${bvid}|${cid}`, // 添加缓存 key，用于统一的缓存文件命名
      },
    });
  } catch (error: any) {
    console.error("获取视频流失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取视频流失败",
      data: null,
    });
  }
});

export default router;
