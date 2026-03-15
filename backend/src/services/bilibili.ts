import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import { Client, Auth } from "@renmu/bili-api";

const BILI_API = "https://api.bilibili.com";
const PASSPORT_API = "https://passport.bilibili.com";

// WBI 签名相关常量
const WBI_MIXIN_KEY_ENC_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

/**
 * 获取 WBI 签名所需的 img_key 和 sub_key
 * @param sessdata 可选的登录凭证
 */
async function getWbiKeys(sessdata?: string) {
  // 使用固定的缓存键，不要用sessdata的值（可能包含特殊字符）
  const cacheKey = sessdata ? "logged_in" : "guest";

  // 检查缓存
  const cached = wbiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < WBI_CACHE_DURATION) {
    console.log(`使用缓存的WBI密钥: ${cacheKey}`);
    return {
      img_key: cached.img_key,
      sub_key: cached.sub_key,
    };
  }

  try {
    const headers: any = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://www.bilibili.com",
    };

    // 如果有登录凭证，则添加到请求头
    if (sessdata) {
      headers.Cookie = `SESSDATA=${sessdata}`;
    }

    console.log(`正在获取WBI密钥: ${cacheKey}`);
    const response = await axios.get(`${BILI_API}/x/web-interface/nav`, {
      headers,
    });

    if (response.data.code !== 0) {
      throw new Error(response.data.message);
    }

    const imgUrl = response.data.data.wbi_img.img_url;
    const subUrl = response.data.data.wbi_img.sub_url;

    const result = {
      img_key: imgUrl.slice(
        imgUrl.lastIndexOf("/") + 1,
        imgUrl.lastIndexOf(".")
      ),
      sub_key: subUrl.slice(
        subUrl.lastIndexOf("/") + 1,
        subUrl.lastIndexOf(".")
      ),
    };

    // 缓存结果
    wbiCache.set(cacheKey, {
      ...result,
      timestamp: Date.now(),
    });

    console.log(`WBI密钥获取成功并已缓存: ${cacheKey}`);
    return result;
  } catch (error: any) {
    console.error("获取 WBI keys 失败:", error.message || error);
    // 如果是未登录错误，尝试不带登录凭证的方式，但避免无限递归
    if (error.message?.includes("未登录") && sessdata) {
      console.log("尝试不带登录凭证获取 WBI keys...");
      // 检查是否已经有访客缓存
      const guestCached = wbiCache.get("guest");
      if (
        guestCached &&
        Date.now() - guestCached.timestamp < WBI_CACHE_DURATION
      ) {
        return {
          img_key: guestCached.img_key,
          sub_key: guestCached.sub_key,
        };
      }
      // 否则获取访客密钥
      return await getWbiKeys(undefined);
    }
    throw error;
  }
}

/**
 * 生成 WBI 签名 mixin key
 */
function getMixinKey(orig: string): string {
  let temp = "";
  for (let i = 0; i < WBI_MIXIN_KEY_ENC_TABLE.length; i++) {
    temp += orig[WBI_MIXIN_KEY_ENC_TABLE[i]];
  }
  return temp.slice(0, 32);
}

/**
 * 为请求参数添加 WBI 签名
 * 重要：签名计算使用原始值，URL编码在发送时进行
 * @param params 请求参数
 * @param sessdata 可选的登录凭证
 */
async function signWbi(
  params: Record<string, any>,
  sessdata?: string
): Promise<Record<string, any>> {
  const { img_key, sub_key } = await getWbiKeys(sessdata);
  const mixinKey = getMixinKey(img_key + sub_key);
  const currTime = Math.round(Date.now() / 1000);

  // 添加 wts 参数，并清理所有值中的特殊字符
  const cleanedParams: Record<string, string | number> = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    // 过滤掉特殊字符 !'()* （仅对字符串类型）
    cleanedParams[key] =
      typeof value === "string" ? value.replace(/[!'()*]/g, "") : value;
  }
  cleanedParams.wts = currTime;

  // 按 key 排序，拼接参数用于签名计算
  // 注意：签名计算时使用 encodeURIComponent 编码
  const queryForSign = Object.keys(cleanedParams)
    .sort()
    .map((key) => {
      const value = cleanedParams[key];
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join("&");

  // 计算 w_rid
  const wbiSign = crypto
    .createHash("md5")
    .update(queryForSign + mixinKey)
    .digest("hex");

  return {
    ...cleanedParams,
    w_rid: wbiSign,
  };
}

// 存储登录状态（生产环境应使用 Redis）
const loginSessions = new Map<
  string,
  {
    url: string;
    key: string;
    status: "pending" | "scanned" | "confirmed" | "expired";
    credentials?: {
      sessdata: string;
      bili_jct: string;
      dedeuserid: string;
      username?: string;
      avatar?: string;
    };
  }
>();

// WBI密钥缓存（避免频繁请求）
interface WbiCache {
  img_key: string;
  sub_key: string;
  timestamp: number;
}

const wbiCache = new Map<string, WbiCache>(); // 按sessdata分组缓存
const WBI_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存（缩短时间，更频繁刷新）

// 清除WBI缓存（用于强制刷新）
export function clearWbiCache() {
  wbiCache.clear();
  console.log("WBI缓存已清除");
}

// 请求频率控制
const requestTimestamps: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 20; // 每分钟最多20次请求

function checkRateLimit(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // 清理超过1分钟的请求记录
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }

  // 检查是否超过限制
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    console.warn(`请求频率超限: ${requestTimestamps.length}次/分钟`);
    return false;
  }

  // 记录本次请求
  requestTimestamps.push(now);
  return true;
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, cache] of wbiCache.entries()) {
    if (now - cache.timestamp > WBI_CACHE_DURATION) {
      wbiCache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`清理了 ${cleaned} 个过期的WBI缓存`);
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

/**
 * 获取登录二维码
 */
export async function getLoginQrcode() {
  try {
    const response = await axios.get(
      `${PASSPORT_API}/x/passport-login/web/qrcode/generate`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.message);
    }

    const { url, qrcode_key } = response.data.data;
    const sessionId = uuidv4();

    loginSessions.set(sessionId, {
      url,
      key: qrcode_key,
      status: "pending",
    });

    // 10分钟后过期
    setTimeout(() => {
      const session = loginSessions.get(sessionId);
      if (session && session.status === "pending") {
        session.status = "expired";
      }
    }, 600000);

    return {
      sessionId,
      url,
    };
  } catch (error) {
    console.error("获取二维码失败:", error);
    throw error;
  }
}

/**
 * 轮询登录状态
 */
export async function pollLoginStatus(sessionId: string) {
  const session = loginSessions.get(sessionId);
  if (!session) {
    throw new Error("会话不存在");
  }

  if (session.status === "expired") {
    return { status: "expired" };
  }

  if (session.status === "confirmed" && session.credentials) {
    return {
      status: "confirmed",
      credentials: session.credentials,
    };
  }

  try {
    const response = await axios.get(
      `${PASSPORT_API}/x/passport-login/web/qrcode/poll`,
      {
        params: { qrcode_key: session.key },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400,
      }
    );

    const { code, message, data } = response.data;

    // 注意: data.code 才是扫码状态, response.data.code 是接口状态
    // data.code 86101: 未扫码
    // data.code 86090: 二维码已扫描但未确认
    // data.code 86038: 二维码已失效
    // data.code 0: 登录成功

    console.log("Poll response:", { code, message, dataCode: data?.code });

    const qrcodeCode = data?.code;

    if (qrcodeCode === 86038) {
      session.status = "expired";
      return { status: "expired" };
    }

    if (qrcodeCode === 86101) {
      return { status: "pending" };
    }

    if (qrcodeCode === 86090) {
      session.status = "scanned";
      return { status: "scanned" };
    }

    if (qrcodeCode === 0) {
      // 登录成功，解析 cookies
      const setCookie = response.headers["set-cookie"];
      console.log("Login success, set-cookie:", setCookie);

      if (setCookie) {
        const cookies = setCookie.join("; ");
        const sessdata = cookies.match(/SESSDATA=([^;]+)/)?.[1];
        const biliJct = cookies.match(/bili_jct=([^;]+)/)?.[1];
        const dedeUserId = cookies.match(/DedeUserID=([^;]+)/)?.[1];

        console.log("Parsed cookies:", {
          sessdata: !!sessdata,
          biliJct: !!biliJct,
          dedeUserId,
        });

        if (sessdata && biliJct) {
          session.status = "confirmed";
          session.credentials = {
            sessdata,
            bili_jct: biliJct,
            dedeuserid: dedeUserId || "",
          };

          // 获取用户信息
          try {
            console.log("Fetching user info with sessdata...");
            const userInfo = await getUserInfo(sessdata);
            console.log("User info fetched:", {
              uname: userInfo?.uname,
              face: userInfo?.face,
            });
            session.credentials.username = userInfo.uname;
            session.credentials.avatar = userInfo.face;
          } catch (e: any) {
            console.error("获取用户信息失败:", e.message || e);
          }

          return {
            status: "confirmed",
            credentials: session.credentials,
          };
        }
      }

      // 如果登录成功但没有获取到 cookies，返回错误
      console.error("登录成功但未获取到必要的 cookies");
      throw new Error("登录成功但未获取到必要的 cookies");
    }

    // 处理未知的状态码
    console.log(
      "Unknown qrcode status:",
      qrcodeCode,
      "current session status:",
      session.status
    );
    return { status: session.status || "pending" };
  } catch (error) {
    console.error("轮询登录状态失败:", error);
    throw error;
  }
}

/**
 * 获取用户信息
 */
export async function getUserInfo(sessdata: string) {
  console.log("Calling BILI_API /x/web-interface/nav...");
  const response = await axios.get(`${BILI_API}/x/web-interface/nav`, {
    headers: {
      Cookie: `SESSDATA=${sessdata}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  console.log("User info API response:", {
    code: response.data?.code,
    message: response.data?.message,
  });

  if (response.data.code !== 0) {
    throw new Error(response.data.message);
  }

  return response.data.data;
}

/**
 * 搜索视频 - 使用 @renmu/bili-api 库
 * @param keyword 搜索关键词
 * @param page 页码
 * @param pageSize 每页数量
 * @param sessdata 可选的登录凭证
 * @param biliJct 可选的bili_jct
 * @param dedeUserId 可选的用户ID
 */
export async function searchVideos(
  keyword: string,
  page: number = 1,
  pageSize: number = 20,
  sessdata?: string,
  biliJct?: string,
  dedeUserId?: string
) {
  // 检查请求频率限制
  if (!checkRateLimit()) {
    throw new Error("请求过于频繁，请稍后再试");
  }

  try {
    // 创建客户端实例
    const client = new Client();

    // 如果有登录凭证，设置认证
    if (sessdata && biliJct) {
      client.setAuth(
        {
          SESSDATA: sessdata,
          bili_jct: biliJct,
          DedeUserID: dedeUserId || "",
        },
        dedeUserId ? parseInt(dedeUserId) : 0,
        undefined
      );
    }

    console.log(`使用 bili-api 库搜索: ${keyword}`);

    // 使用库的搜索接口（注意：库不支持 page_size 参数）
    const result = await client.search.type({
      keyword,
      search_type: "video",
      page,
    });

    console.log(`搜索成功，找到 ${result?.numResults || 0} 个结果`);
    return result;
  } catch (error: any) {
    console.error("bili-api 搜索失败:", error.message || error);

    // 如果库也失败，回退到原来的实现
    console.log("尝试使用备用搜索方案...");
    return await searchVideosFallback(keyword, page, pageSize, sessdata);
  }
}

/**
 * 备用搜索方案 - 使用原始实现
 */
async function searchVideosFallback(
  keyword: string,
  page: number = 1,
  pageSize: number = 20,
  sessdata?: string
) {
  // 使用 WBI 签名
  const signedParams = await signWbi(
    {
      keyword,
      search_type: "video",
      page,
      page_size: pageSize,
    },
    sessdata
  );

  // 手动构建查询字符串，确保空格编码为 %20 而不是 +
  const queryString = Object.keys(signedParams)
    .map((key) => {
      const value = signedParams[key as keyof typeof signedParams];
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join("&");

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Referer:
      "https://search.bilibili.com/all?keyword=" + encodeURIComponent(keyword),
    Origin: "https://search.bilibili.com",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Cache-Control": "no-cache",
    "Sec-Ch-Ua":
      '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
  };

  // 添加登录Cookie（如果有）
  if (sessdata) {
    headers.Cookie = `SESSDATA=${sessdata}`;
  }

  const response = await axios.get(
    `${BILI_API}/x/web-interface/search/type?${queryString}`,
    { headers }
  );

  if (response.data.code !== 0) {
    throw new Error(response.data.message);
  }

  return response.data.data;
}

/**
 * 获取视频详情
 */
export async function getVideoDetail(bvid: string, sessdata?: string) {
  const headers: any = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://www.bilibili.com",
  };

  if (sessdata) {
    headers["Cookie"] = `SESSDATA=${sessdata}`;
  }

  const response = await axios.get(`${BILI_API}/x/web-interface/view`, {
    params: { bvid },
    headers,
  });

  if (response.data.code !== 0) {
    throw new Error(response.data.message);
  }

  return response.data.data;
}

/**
 * 获取视频流地址
 */
export async function getVideoStream(
  bvid: string,
  cid: string,
  sessdata?: string
) {
  const headers: any = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://www.bilibili.com",
  };

  if (sessdata) {
    headers["Cookie"] = `SESSDATA=${sessdata}`;
  }

  const response = await axios.get(`${BILI_API}/x/player/playurl`, {
    params: {
      bvid,
      cid,
      fnval: 16, // DASH 格式
      fourk: 1,
    },
    headers,
  });

  if (response.data.code !== 0) {
    throw new Error(response.data.message);
  }

  return response.data.data;
}

// 导出用于监控的函数
export function getWbiCacheStats() {
  return {
    size: wbiCache.size,
    entries: Array.from(wbiCache.entries()).map(([key, cache]) => ({
      key,
      age: Date.now() - cache.timestamp,
    })),
  };
}

export { loginSessions };

/**
 * 获取APP/TV授权登录URL
 * 返回一个可以在APP中打开的授权页面URL
 */
export async function getAppAuthUrl() {
  try {
    // 使用标准的网页二维码接口，APP扫描后可以授权
    const response = await axios.get(
      `${PASSPORT_API}/x/passport-login/web/qrcode/generate`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.message);
    }

    const { url, qrcode_key } = response.data.data;
    const sessionId = uuidv4();

    // 保存会话信息
    loginSessions.set(sessionId, {
      url,
      key: qrcode_key,
      status: "pending",
    });

    // 10分钟后过期
    setTimeout(() => {
      const session = loginSessions.get(sessionId);
      if (session && session.status === "pending") {
        session.status = "expired";
      }
    }, 600000);

    // 构建APP授权URL
    // 方式1: bilibili:// 协议调起APP
    const appAuthUrl = `bilibili://browser/v6?url=${encodeURIComponent(url)}`;

    // 方式2: 直接返回H5授权页面URL
    const authUrl = url;

    return {
      sessionId,
      key: qrcode_key,
      authUrl,
      appAuthUrl,
      qrcodeUrl: authUrl,
    };
  } catch (error) {
    console.error("获取APP授权URL失败:", error);
    throw error;
  }
}

/**
 * 轮询APP授权登录状态
 * @param sessionId 会话ID
 */
export async function pollAppAuthStatus(sessionId: string) {
  // 复用扫码登录的轮询逻辑
  return await pollLoginStatus(sessionId);
}

/**
 * 获取推荐音乐（音乐区热门排行榜）
 * @param rid 分区ID，音乐区为31
 * @param page 页码
 * @param pageSize 每页数量
 */
export async function getRecommendVideos(
  rid: number = 31, // 音乐区
  page: number = 1,
  pageSize: number = 20
) {
  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://www.bilibili.com",
    };

    // 使用排行榜 API
    const response = await axios.get(
      `${BILI_API}/x/web-interface/ranking/v2?rid=${rid}&type=1`,
      { headers }
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.message);
    }

    // 格式化结果
    const videos =
      response.data.data?.list?.map((item: any) => ({
        bvid: item.bvid,
        title: item.title,
        description: item.desc,
        author: item.owner?.name,
        pic: item.pic,
        duration: item.duration,
        pubdate: item.pubdate,
        view: item.stat?.view || item.play,
        like: item.stat?.like || item.like,
        cid: item.cid,
      })) || [];

    return {
      videos,
      numResults: videos.length,
    };
  } catch (error: any) {
    console.error("获取推荐音乐失败:", error.message || error);
    // 如果排行榜API失败，使用搜索API搜索热门关键词
    const result = await searchVideos("热门音乐", page, pageSize);
    // 格式化搜索结果
    const videos =
      result.result?.map((item: any) => ({
        bvid: item.bvid,
        title: item.title.replace(/<[^>]+>/g, ""), // 去除 HTML 标签
        description: item.description,
        author: item.author,
        pic: item.pic,
        duration: item.duration,
        pubdate: item.pubdate,
        view: item.play,
        like: item.like,
        cid: item.cid,
      })) || [];

    return {
      videos,
      numResults: videos.length,
    };
  }
}
