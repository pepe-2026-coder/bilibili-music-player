import { Router } from "express";
import {
  getLoginQrcode,
  pollLoginStatus,
  getUserInfo,
  getAppAuthUrl,
  pollAppAuthStatus,
} from "../services/bilibili";
import db from "../models/database";

const router = Router();

/**
 * 获取登录二维码
 * GET /api/auth/qrcode
 */
router.get("/qrcode", async (req, res) => {
  try {
    const result = await getLoginQrcode();
    res.json({
      code: 0,
      message: "success",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || "获取二维码失败",
      data: null,
    });
  }
});

/**
 * 轮询登录状态
 * GET /api/auth/qrcode/poll?sessionId=xxx
 */
router.get("/qrcode/poll", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        code: 400,
        message: "缺少 sessionId 参数",
        data: null,
      });
    }

    const result = await pollLoginStatus(sessionId);

    // 如果登录成功，保存用户信息到数据库
    if (result.status === "confirmed" && result.credentials) {
      const { sessdata, bili_jct, dedeuserid, username, avatar } =
        result.credentials;

      // 检查用户是否已存在
      const existingUser = db
        .prepare("SELECT * FROM users WHERE bili_uid = ?")
        .get(dedeuserid);

      if (existingUser) {
        // 更新用户信息
        db.prepare(
          `
          UPDATE users 
          SET sessdata = ?, bili_username = ?, bili_avatar = ? 
          WHERE bili_uid = ?
        `
        ).run(sessdata, username || "", avatar || "", dedeuserid);
      } else {
        // 创建新用户
        db.prepare(
          `
          INSERT INTO users (bili_uid, bili_username, bili_avatar, sessdata) 
          VALUES (?, ?, ?, ?)
        `
        ).run(dedeuserid, username || "", avatar || "", sessdata);
      }
    }

    res.json({
      code: 0,
      message: "success",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || "轮询登录状态失败",
      data: null,
    });
  }
});

/**
 * 获取APP授权登录信息
 * GET /api/auth/app-qrcode
 */
router.get("/app-qrcode", async (req, res) => {
  try {
    const result = await getAppAuthUrl();
    res.json({
      code: 0,
      message: "success",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || "获取APP授权码失败",
      data: null,
    });
  }
});

/**
 * 轮询APP授权登录状态
 * GET /api/auth/app-qrcode/poll?sessionId=xxx
 */
router.get("/app-qrcode/poll", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        code: 400,
        message: "缺少 sessionId 参数",
        data: null,
      });
    }

    const result = await pollAppAuthStatus(sessionId);

    // 如果登录成功，保存用户信息到数据库
    if (result.status === "confirmed" && result.credentials) {
      const { sessdata, bili_jct, dedeuserid, username, avatar } =
        result.credentials;

      // 检查用户是否已存在
      const existingUser = db
        .prepare("SELECT * FROM users WHERE bili_uid = ?")
        .get(dedeuserid);

      if (existingUser) {
        // 更新用户信息
        db.prepare(
          `
          UPDATE users 
          SET sessdata = ?, bili_username = ?, bili_avatar = ? 
          WHERE bili_uid = ?
        `
        ).run(sessdata, username || "", avatar || "", dedeuserid);
      } else {
        // 创建新用户
        db.prepare(
          `
          INSERT INTO users (bili_uid, bili_username, bili_avatar, sessdata) 
          VALUES (?, ?, ?, ?)
        `
        ).run(dedeuserid, username || "", avatar || "", sessdata);
      }
    }

    res.json({
      code: 0,
      message: "success",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || "轮询APP授权登录状态失败",
      data: null,
    });
  }
});

/**
 * 获取登录状态
 * GET /api/auth/status
 */
router.get("/status", async (req, res) => {
  try {
    // 获取最新的登录用户
    const user = db
      .prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 1")
      .get();

    if (!user) {
      return res.json({
        code: 0,
        message: "success",
        data: { isLoggedIn: false },
      });
    }

    // 验证登录状态
    try {
      const userInfo = await getUserInfo((user as any).sessdata);
      res.json({
        code: 0,
        message: "success",
        data: {
          isLoggedIn: true,
          user: {
            uid: userInfo.mid,
            username: userInfo.uname,
            avatar: userInfo.face || (user as any).bili_avatar,
          },
        },
      });
    } catch (error) {
      // 登录已过期
      res.json({
        code: 0,
        message: "success",
        data: { isLoggedIn: false },
      });
    }
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || "获取登录状态失败",
      data: null,
    });
  }
});

/**
 * 退出登录
 * POST /api/auth/logout
 */
router.post("/logout", (req, res) => {
  try {
    console.log("收到退出登录请求");

    // 检查数据库中是否有用户
    const user = db
      .prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 1")
      .get();

    if (user) {
      console.log("找到用户，准备删除:", (user as any).bili_username);
    } else {
      console.log("数据库中没有用户记录");
    }

    // 清除所有用户数据（单用户模式）
    // 禁用外键约束进行检查
    db.pragma("foreign_keys = OFF");
    // 删除所有相关数据
    db.prepare("DELETE FROM playlist_songs").run();
    db.prepare("DELETE FROM playlists").run();
    db.prepare("DELETE FROM downloads").run();
    const result = db.prepare("DELETE FROM users").run();
    // 重新启用外键约束
    db.pragma("foreign_keys = ON");
    console.log("删除结果:", result);

    res.json({
      code: 0,
      message: "退出登录成功",
      data: null,
    });
  } catch (error: any) {
    console.error("退出登录失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "退出登录失败",
      data: null,
    });
  }
});

export default router;
