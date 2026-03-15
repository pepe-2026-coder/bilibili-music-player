import { Router } from "express";
import {
  searchVideos,
  getVideoDetail,
  getWbiCacheStats,
  clearWbiCache,
  getRecommendVideos,
} from "../services/bilibili";
import db from "../models/database";

const router = Router();

// 搜索频率限制
const searchRateLimit = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟窗口
const MAX_SEARCHES_PER_MINUTE = 10; // 每分钟最多10次搜索

/**
 * 搜索视频
 * GET /api/search?keyword=xxx&page=1&pageSize=20
 */
router.get("/", async (req, res) => {
  // 检查搜索频率限制
  const clientIP = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();

  if (!searchRateLimit.has(clientIP)) {
    searchRateLimit.set(clientIP, { count: 0, lastReset: now });
  }

  const rateInfo = searchRateLimit.get(clientIP)!;

  // 重置计数器如果超过时间窗口
  if (now - rateInfo.lastReset > RATE_LIMIT_WINDOW) {
    rateInfo.count = 0;
    rateInfo.lastReset = now;
  }

  // 检查是否超出限制
  if (rateInfo.count >= MAX_SEARCHES_PER_MINUTE) {
    return res.status(429).json({
      code: 429,
      message: `搜索过于频繁，请稍后再试 (每分钟最多${MAX_SEARCHES_PER_MINUTE}次)`,
      data: null,
    });
  }

  // 增加计数
  rateInfo.count++;
  try {
    const { keyword, page = "1", pageSize = "20" } = req.query;

    if (!keyword || typeof keyword !== "string") {
      return res.status(400).json({
        code: 400,
        message: "缺少 keyword 参数",
        data: null,
      });
    }

    // 获取当前用户的登录凭证（如果有）
    // 注意：数据库中只有 sessdata 和 bili_uid
    const user = db
      .prepare(
        "SELECT sessdata, bili_uid FROM users ORDER BY created_at DESC LIMIT 1"
      )
      .get() as any;

    let result;
    let retried = false;

    try {
      result = await searchVideos(
        keyword,
        parseInt(page as string),
        parseInt(pageSize as string),
        user?.sessdata,
        undefined, // bili_jct 不可用
        user?.bili_uid
      );
    } catch (searchError: any) {
      // 如果是412错误，清除WBI缓存并重试一次
      if (searchError.response?.status === 412 || searchError.status === 412) {
        console.log("遇到412错误，清除WBI缓存并重试...");
        clearWbiCache();

        // 等待一小段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 1000));

        result = await searchVideos(
          keyword,
          parseInt(page as string),
          parseInt(pageSize as string),
          user?.sessdata,
          undefined, // bili_jct 不可用
          user?.bili_uid
        );
        retried = true;
        console.log("重试成功");
      } else {
        throw searchError;
      }
    }

    // 格式化搜索结果
    // 注意：Bilibili 搜索 API 返回的数据中没有 stat 对象
    // 播放量在 play 字段，点赞数在 like 字段
    const videos =
      result.result?.map((item: any) => {
        return {
          bvid: item.bvid,
          title: item.title.replace(/<[^>]+>/g, ""), // 去除 HTML 标签
          description: item.description,
          author: item.author,
          pic: item.pic,
          duration: item.duration,
          pubdate: item.pubdate,
          view: item.play, // 播放量在 play 字段
          like: item.like, // 点赞数在 like 字段
          cid: item.cid,
        };
      }) || [];

    res.json({
      code: 0,
      message: "success",
      data: {
        videos,
        total: result.numResults || 0,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
      },
    });
  } catch (error: any) {
    console.error("搜索失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "搜索失败",
      data: null,
    });
  }
});

/**
 * 获取视频详情
 * GET /api/search/detail/:bvid
 */
router.get("/detail/:bvid", async (req, res) => {
  try {
    const { bvid } = req.params;

    // 获取当前用户的 sessdata（如果有）
    const user = db
      .prepare("SELECT sessdata FROM users ORDER BY created_at DESC LIMIT 1")
      .get() as any;

    const result = await getVideoDetail(bvid, user?.sessdata);

    // 格式化视频详情
    const video = {
      bvid: result.bvid,
      aid: result.aid,
      title: result.title,
      description: result.desc,
      pic: result.pic,
      author: {
        mid: result.owner?.mid,
        name: result.owner?.name,
        face: result.owner?.face,
      },
      duration: result.duration,
      pubdate: result.pubdate,
      stat: {
        view: result.stat?.view,
        like: result.stat?.like,
        coin: result.stat?.coin,
        favorite: result.stat?.favorite,
        share: result.stat?.share,
      },
      pages: result.pages?.map((page: any) => ({
        cid: page.cid,
        page: page.page,
        part: page.part,
        duration: page.duration,
      })),
    };

    res.json({
      code: 0,
      message: "success",
      data: video,
    });
  } catch (error: any) {
    console.error("获取视频详情失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取视频详情失败",
      data: null,
    });
  }
});

// 监控端点 - 查看WBI缓存状态
router.get("/debug/wbi-cache", (req, res) => {
  const stats = getWbiCacheStats();
  res.json({
    code: 0,
    message: "success",
    data: {
      ...stats,
      rateLimits: Array.from(searchRateLimit.entries()).map(([ip, info]) => ({
        ip,
        count: info.count,
        lastReset: new Date(info.lastReset).toISOString(),
        age: Date.now() - info.lastReset,
      })),
    },
  });
});

/**
 * 获取推荐音乐
 * GET /api/search/recommend
 */
router.get("/recommend", async (req, res) => {
  try {
    const { page = "1", pageSize = "20" } = req.query;
    
    const result = await getRecommendVideos(
      31, // 音乐区
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    res.json({
      code: 0,
      message: "success",
      data: {
        videos: result.videos,
        total: result.numResults,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
      },
    });
  } catch (error: any) {
    console.error("获取推荐音乐失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取推荐音乐失败",
      data: null,
    });
  }
});

export default router;
