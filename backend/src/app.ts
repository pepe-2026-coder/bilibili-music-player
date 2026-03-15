import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { initializeDatabase } from "./models/database";
import authRoutes from "./routes/auth";
import searchRoutes from "./routes/search";
import videoRoutes from "./routes/video";
import playlistRoutes from "./routes/playlist";
import downloadRoutes from "./routes/download";
import proxyRoutes from "./routes/proxy";

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use("/downloads", express.static(path.join(__dirname, "../downloads")));
app.use("/cache", express.static(path.join(__dirname, "../cache")));

// 初始化数据库
initializeDatabase();

// 路由
app.use("/api/auth", authRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/playlist", playlistRoutes);
app.use("/api/download", downloadRoutes);
app.use("/api/proxy", proxyRoutes);

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 生产环境：提供前端静态文件
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../public")));

  // 所有非 API 路由都返回前端应用
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
  });
}

// 错误处理
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      code: 500,
      message: "服务器内部错误",
      data: null,
    });
  }
);

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

export default app;
