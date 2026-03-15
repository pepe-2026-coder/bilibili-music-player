import { Router } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import db from "../models/database";
import { getVideoStream } from "../services/bilibili";

const router = Router();

const DOWNLOAD_DIR = path.join(__dirname, "../../downloads");
const TEMP_DIR = path.join(__dirname, "../../temp");

// 确保目录存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 存储下载任务状态
const downloadTasks = new Map<
  string,
  {
    status: "pending" | "downloading" | "converting" | "completed" | "failed";
    progress: number;
    filePath?: string;
    error?: string;
  }
>();

/**
 * 创建下载任务
 * POST /api/download
 */
router.post("/", async (req, res) => {
  try {
    const { bvid, cid, title, format = "mp3" } = req.body;

    if (!bvid || !cid || !title) {
      return res.status(400).json({
        code: 400,
        message: "缺少必要参数",
        data: null,
      });
    }

    // 获取视频流地址
    const user = db
      .prepare("SELECT sessdata FROM users ORDER BY created_at DESC LIMIT 1")
      .get() as any;
    const streamInfo = await getVideoStream(bvid, cid, user?.sessdata);

    if (
      !streamInfo.dash ||
      (!streamInfo.dash.audio && !streamInfo.dash.video)
    ) {
      return res.status(400).json({
        code: 400,
        message: "无法获取视频流",
        data: null,
      });
    }

    // 创建下载记录
    const result = db
      .prepare(
        `
      INSERT INTO downloads (bvid, cid, title, format, status, progress) 
      VALUES (?, ?, ?, ?, 'pending', 0)
    `
      )
      .run(bvid, cid, title, format);

    const downloadId = result.lastInsertRowid.toString();

    // 开始下载任务
    downloadTasks.set(downloadId, { status: "pending", progress: 0 });

    // 异步执行下载
    processDownload(
      downloadId,
      bvid,
      cid,
      title,
      format,
      streamInfo,
      user?.sessdata
    );

    res.json({
      code: 0,
      message: "下载任务已创建",
      data: { downloadId },
    });
  } catch (error: any) {
    console.error("创建下载任务失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "创建下载任务失败",
      data: null,
    });
  }
});

/**
 * 处理下载任务
 */
async function processDownload(
  downloadId: string,
  bvid: string,
  cid: string,
  title: string,
  format: string,
  streamInfo: any,
  sessdata?: string
) {
  const task = downloadTasks.get(downloadId);
  if (!task) return;

  try {
    task.status = "downloading";
    db.prepare("UPDATE downloads SET status = 'downloading' WHERE id = ?").run(
      downloadId
    );

    // 清理文件名
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, "_");
    const tempVideoPath = path.join(TEMP_DIR, `${bvid}_${cid}_video.mp4`);
    const tempAudioPath = path.join(TEMP_DIR, `${bvid}_${cid}_audio.m4a`);
    const outputPath = path.join(DOWNLOAD_DIR, `${safeTitle}.${format}`);

    // 下载音频流
    const audioUrl = streamInfo.dash.audio?.[0]?.baseUrl;
    const videoUrl = streamInfo.dash.video?.[0]?.baseUrl;

    if (!audioUrl) {
      throw new Error("无法获取音频流");
    }

    // 下载音频
    await downloadFile(audioUrl, tempAudioPath, sessdata, (progress) => {
      task.progress = Math.floor(progress * 0.5); // 音频下载占 50%
      db.prepare("UPDATE downloads SET progress = ? WHERE id = ?").run(
        task.progress,
        downloadId
      );
    });

    if (format === "mp3") {
      // 转换为 MP3
      task.status = "converting";
      db.prepare("UPDATE downloads SET status = 'converting' WHERE id = ?").run(
        downloadId
      );

      await convertToMp3(tempAudioPath, outputPath);

      task.progress = 100;
    } else {
      // 下载完整视频
      if (videoUrl) {
        await downloadFile(videoUrl, tempVideoPath, sessdata, (progress) => {
          task.progress = Math.floor(50 + progress * 0.5); // 视频下载占 50%
          db.prepare("UPDATE downloads SET progress = ? WHERE id = ?").run(
            task.progress,
            downloadId
          );
        });

        // 合并音视频
        await mergeVideoAudio(tempVideoPath, tempAudioPath, outputPath);
      } else {
        // 只有音频，直接复制
        fs.copyFileSync(tempAudioPath, outputPath.replace(".mp4", ".m4a"));
      }

      task.progress = 100;
    }

    // 清理临时文件
    try {
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    } catch (e) {
      console.error("清理临时文件失败:", e);
    }

    // 获取文件大小
    const stats = fs.statSync(outputPath);

    // 更新数据库
    db.prepare(
      `
      UPDATE downloads 
      SET status = 'completed', progress = 100, file_path = ?, file_size = ?, completed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `
    ).run(outputPath, stats.size, downloadId);

    task.status = "completed";
    task.filePath = outputPath;
  } catch (error: any) {
    console.error("下载任务失败:", error);
    task.status = "failed";
    task.error = error.message;
    db.prepare("UPDATE downloads SET status = 'failed' WHERE id = ?").run(
      downloadId
    );
  }
}

/**
 * 下载文件
 */
function downloadFile(
  url: string,
  outputPath: string,
  sessdata?: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const headers: any = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.bilibili.com",
      };

      if (sessdata) {
        headers["Cookie"] = `SESSDATA=${sessdata}`;
      }

      const response = await axios({
        method: "GET",
        url,
        headers,
        responseType: "stream",
      });

      const totalLength = parseInt(response.headers["content-length"], 10);
      let downloadedLength = 0;

      const writer = fs.createWriteStream(outputPath);

      response.data.on("data", (chunk: Buffer) => {
        downloadedLength += chunk.length;
        if (onProgress && totalLength) {
          onProgress(downloadedLength / totalLength);
        }
      });

      response.data.pipe(writer);

      writer.on("finish", () => {
        writer.close();
        resolve();
      });

      writer.on("error", (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 转换为 MP3
 */
function convertToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      inputPath,
      "-vn",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-b:a",
      "192k",
      "-f",
      "mp3",
      "-y",
      outputPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg 退出码: ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * 合并音视频
 */
function mergeVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      "-y",
      outputPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg 退出码: ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * 获取下载进度
 * GET /api/download/:id
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;

    const download = db.prepare("SELECT * FROM downloads WHERE id = ?").get(id);
    if (!download) {
      return res.status(404).json({
        code: 404,
        message: "下载任务不存在",
        data: null,
      });
    }

    res.json({
      code: 0,
      message: "success",
      data: download,
    });
  } catch (error: any) {
    console.error("获取下载进度失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取下载进度失败",
      data: null,
    });
  }
});

/**
 * 获取下载列表
 * GET /api/download?page=1&pageSize=20
 */
router.get("/", (req, res) => {
  try {
    const { page = "1", pageSize = "20" } = req.query;
    const limit = parseInt(pageSize as string);
    const offset = (parseInt(page as string) - 1) * limit;

    const downloads = db
      .prepare(
        `
      SELECT * FROM downloads 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset);

    const total = (
      db.prepare("SELECT COUNT(*) as count FROM downloads").get() as any
    ).count;

    res.json({
      code: 0,
      message: "success",
      data: {
        downloads,
        total,
      },
    });
  } catch (error: any) {
    console.error("获取下载列表失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取下载列表失败",
      data: null,
    });
  }
});

/**
 * 下载文件
 * GET /api/download/:id/file
 */
router.get("/:id/file", (req, res) => {
  try {
    const { id } = req.params;

    const download = db
      .prepare("SELECT * FROM downloads WHERE id = ?")
      .get(id) as any;
    if (!download) {
      return res.status(404).json({
        code: 404,
        message: "下载任务不存在",
        data: null,
      });
    }

    if (download.status !== "completed" || !download.file_path) {
      return res.status(400).json({
        code: 400,
        message: "文件尚未下载完成",
        data: null,
      });
    }

    if (!fs.existsSync(download.file_path)) {
      return res.status(404).json({
        code: 404,
        message: "文件不存在",
        data: null,
      });
    }

    res.download(download.file_path);
  } catch (error: any) {
    console.error("下载文件失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "下载文件失败",
      data: null,
    });
  }
});

/**
 * 删除下载任务
 * DELETE /api/download/:id
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;

    const download = db
      .prepare("SELECT * FROM downloads WHERE id = ?")
      .get(id) as any;
    if (!download) {
      return res.status(404).json({
        code: 404,
        message: "下载任务不存在",
        data: null,
      });
    }

    // 删除文件
    if (download.file_path && fs.existsSync(download.file_path)) {
      fs.unlinkSync(download.file_path);
    }

    // 删除记录
    db.prepare("DELETE FROM downloads WHERE id = ?").run(id);

    res.json({
      code: 0,
      message: "删除成功",
      data: null,
    });
  } catch (error: any) {
    console.error("删除下载任务失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "删除下载任务失败",
      data: null,
    });
  }
});

export default router;
