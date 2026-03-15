import { Router } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Writable } from "stream";

const router = Router();

// 缓存目录
const CACHE_DIR = path.join(__dirname, "../../cache");
const IMAGE_CACHE_DIR = path.join(CACHE_DIR, "images");
const MEDIA_CACHE_DIR = path.join(CACHE_DIR, "media");

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(MEDIA_CACHE_DIR)) {
  fs.mkdirSync(MEDIA_CACHE_DIR, { recursive: true });
}

/**
 * 获取缓存文件路径
 */
function getCachePath(
  url: string,
  type: "image" | "media",
  customKey?: string
): { cachePath: string; tempPath: string } {
  let hash: string;

  // 如果提供了自定义 key（如 bvid|cid），使用它生成哈希
  if (customKey) {
    hash = crypto.createHash("md5").update(customKey).digest("hex");
  } else {
    // 否则使用完整 URL 生成哈希
    hash = crypto.createHash("md5").update(url).digest("hex");
  }

  const ext = path.extname(new URL(completeUrl(url)).pathname) || ".bin";
  const dir = type === "image" ? IMAGE_CACHE_DIR : MEDIA_CACHE_DIR;
  const cachePath = path.join(dir, `${hash}${ext}`);
  const tempPath = path.join(dir, `${hash}${ext}.tmp`);
  return { cachePath, tempPath };
}

/**
 * 补全相对URL为完整URL
 */
function completeUrl(url: string): string {
  // 如果已经是完整URL，直接返回
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // 如果是相对路径，补全为B站域名
  if (url.startsWith("/")) {
    return `https:${url}`;
  }

  // 其他情况也尝试补全
  return `https://${url}`;
}

/**
 * 代理图片请求
 * GET /api/proxy/image?url=xxx
 */
router.get("/image", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        code: 400,
        message: "缺少 url 参数",
        data: null,
      });
    }

    // 检查缓存
    const imageCache = getCachePath(url, "image");
    const imageCachePath = imageCache.cachePath;
    if (fs.existsSync(imageCachePath)) {
      // 返回缓存的图片
      const ext = path.extname(imageCachePath).slice(1) || "jpeg";
      res.setHeader("Content-Type", `image/${ext}`);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(imageCachePath);
    }

    // 补全URL并从 B站获取图片
    const completeImageUrl = completeUrl(url);
    const response = await axios({
      method: "GET",
      url: completeImageUrl,
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.bilibili.com",
      },
      timeout: 30000,
    });

    // 设置响应头
    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");

    // 同时写入缓存和响应
    const writer = fs.createWriteStream(imageCachePath);

    response.data.pipe(writer);
    response.data.pipe(res);

    writer.on("error", (err) => {
      console.error("缓存图片失败:", err);
      // 删除失败的缓存文件
      fs.unlink(imageCachePath, () => {});
    });
  } catch (error: any) {
    console.error("代理图片失败:", error.message);
    res.status(500).json({
      code: 500,
      message: "获取图片失败",
      data: null,
    });
  }
});

/**
 * 代理媒体流请求（音频/视频）
 * GET /api/proxy/media?url=xxx&type=audio|video
 * 支持边缓存边播放（Range 请求）
 */
router.get("/media", async (req, res) => {
  try {
    const { url, type = "audio", check } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        code: 400,
        message: "缺少 url 参数",
        data: null,
      });
    }

    // 判断是否是 bvid|cid 格式的自定义缓存 key
    let cacheKey: string | undefined;
    let actualAudioUrl: string;

    // 如果是 bvid|cid 格式（包含 | 分隔符）
    if (url.includes("|")) {
      cacheKey = url; // 使用 bvid|cid 作为缓存 key

      // 解析 bvid 和 cid，从视频接口获取真实音频流 URL
      const [bvid, cid] = url.split("|");

      // 先检查是否有缓存（基于 cacheKey）
      // 构造一个临时的 URL 用于生成缓存路径（实际不会用这个去请求）
      actualAudioUrl = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}`;

      // 如果缓存不存在且是检查请求，直接返回 MISS
      const tempCachePathResult = getCachePath(actualAudioUrl, "media", cacheKey);
      if (check === "1" && !fs.existsSync(tempCachePathResult.cachePath)) {
        res.setHeader("X-Cache-Status", "MISS");
        return res.status(404).json({
          code: 404,
          message: "缓存不存在",
          data: null,
        });
      }
    } else {
      // 普通 URL，不使用自定义 key
      actualAudioUrl = url;
    }

    // 补全 URL
    const completeMediaUrl = completeUrl(actualAudioUrl);

    // 获取缓存路径（包括临时文件路径）
    const { cachePath, tempPath } = getCachePath(completeMediaUrl, "media", cacheKey);
    const isVideo = type === "video";

    // 检查是否有未完成的临时下载（之前下载中断留下的）
    if (fs.existsSync(tempPath)) {
      console.log("发现未完成的下载，删除临时文件并重新下载");
      fs.unlinkSync(tempPath);
    }

    // 检查是否已完全缓存（只有正式的缓存文件才算有效缓存）
    if (fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath);
      if (stat.size > 0) {
        // 已缓存，直接提供文件
        const ext =
          path.extname(cachePath).slice(1) || (isVideo ? "mp4" : "m4a");
        const mimeType = isVideo
          ? `video/${ext === "mp4" ? "mp4" : "webm"}`
          : `audio/${ext === "mp3" ? "mpeg" : "mp4"}`;

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "public, max-age=86400");

        // 如果是检查请求，只返回头信息
        if (check === "1") {
          res.setHeader("X-Cache-Status", "HIT");
          res.setHeader("Content-Length", stat.size);
          return res.status(200).send();
        }

        // 处理 Range 请求
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          const chunksize = end - start + 1;

          res.status(206);
          res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
          res.setHeader("Content-Length", chunksize);

          const stream = fs.createReadStream(cachePath, { start, end });
          stream.pipe(res);
        } else {
          res.setHeader("Content-Length", stat.size);
          fs.createReadStream(cachePath).pipe(res);
        }
        return;
      }
    }

    // 如果是检查请求但缓存不存在，返回 404
    if (check === "1") {
      res.setHeader("X-Cache-Status", "MISS");
      return res.status(404).json({
        code: 404,
        message: "缓存不存在",
        data: null,
      });
    }

    // 如果传入的是 bvid|cid，需要先从视频接口获取真实音频流 URL
    let finalAudioUrl = actualAudioUrl;
    if (cacheKey) {
      try {
        const [bvid, cid] = cacheKey.split("|");
        // 调用内部视频接口获取真实 URL
        const videoResponse = await fetch(
          `http://localhost:3000/api/video/${bvid}/stream?cid=${cid}`
        );
        const videoData: any = await videoResponse.json();

        if (videoData.code === 0 && videoData.data.audioUrl) {
          finalAudioUrl = videoData.data.audioUrl;
        } else {
          throw new Error("无法获取音频流");
        }
      } catch (error: any) {
        console.error("获取真实音频流失败:", error.message);
        return res.status(500).json({
          code: 500,
          message: "获取音频流失败",
          data: null,
        });
      }
    }

    // 从 B站获取媒体流
    const headers: any = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://www.bilibili.com",
      Accept: isVideo
        ? "video/webm,video/mp4,video/*"
        : "audio/webm,audio/mp4,audio/*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Accept-Encoding": "identity", // 避免压缩，支持 Range
    };

    // 转发 Range 请求
    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const response = await axios({
      method: "GET",
      url: finalAudioUrl,
      responseType: "stream",
      headers,
      timeout: 60000,
      validateStatus: (status) => status < 500,
    });

    if (response.status >= 400) {
      return res.status(response.status).json({
        code: response.status,
        message: "获取媒体流失败",
        data: null,
      });
    }

    // 设置响应头
    const contentType =
      response.headers["content-type"] || (isVideo ? "video/mp4" : "audio/mp4");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");

    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }

    if (response.headers["content-range"]) {
      res.setHeader("Content-Range", response.headers["content-range"]);
      res.status(206);
    }

    // 创建临时缓存写入流（先写入 .tmp 文件）
    const cacheStream = fs.createWriteStream(tempPath, { flags: "w" });

    // 使用 tee 模式：同时写入缓存和响应客户端
    const teewriter = new Writable({
      write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        cacheStream.write(chunk, () => {}); // 写入缓存
        res.write(chunk, callback); // 写入响应
      }
    });

    response.data.pipe(teewriter);

    // 处理源流（b站服务器）错误
    response.data.on("error", (err: Error) => {
      console.error("媒体流下载错误:", err.message);
      cacheStream.destroy();
      teewriter.destroy();
      // 下载失败时删除临时文件
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    });

    // 处理缓存写入流错误
    cacheStream.on("error", (err: Error) => {
      console.error("写入缓存文件错误:", err.message);
    });

    // 处理客户端响应流错误（如客户端断开连接）
    res.on("error", (err: Error) => {
      console.error("响应客户端错误:", err.message);
      cacheStream.destroy();
      teewriter.destroy();
    });

    // 处理客户端断开连接
    req.on("close", () => {
      console.log("客户端断开连接，停止下载");
      cacheStream.destroy();
      teewriter.destroy();
    });

    teewriter.on("error", (err: Error) => {
      console.error("写入响应错误:", err.message);
    });

    teewriter.on("finish", () => {
      cacheStream.end();
      // 下载完成后，将临时文件重命名为正式缓存文件
      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, cachePath);
        console.log("缓存下载完成:", cachePath);
      }
      res.end();
    });
  } catch (error: any) {
    // 确保错误不会导致程序崩溃
    console.error("代理媒体流失败:", error.message);
    try {
      if (!res.headersSent) {
        res.status(500).json({
          code: 500,
          message: "获取媒体流失败",
          data: null,
        });
      } else {
        res.end();
      }
    } catch (e) {
      console.error("发送错误响应失败:", e);
    }
  }
});

/**
 * 清理缓存
 * DELETE /api/proxy/cache
 */
router.delete("/cache", (req, res) => {
  try {
    const { type } = req.query;

    const clearDir = (dir: string) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          fs.unlinkSync(path.join(dir, file));
        }
      }
    };

    if (type === "image") {
      clearDir(IMAGE_CACHE_DIR);
    } else if (type === "media") {
      clearDir(MEDIA_CACHE_DIR);
    } else {
      clearDir(IMAGE_CACHE_DIR);
      clearDir(MEDIA_CACHE_DIR);
    }

    res.json({
      code: 0,
      message: "缓存已清理",
      data: null,
    });
  } catch (error: any) {
    console.error("清理缓存失败:", error);
    res.status(500).json({
      code: 500,
      message: "清理缓存失败",
      data: null,
    });
  }
});

export default router;
