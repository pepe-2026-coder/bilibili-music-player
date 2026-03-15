import { create } from "zustand";
import type { User } from "../types";
import { authApi } from "../services/api";

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  isLoading: boolean;
  checkLoginStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,
  isLoading: true,

  checkLoginStatus: async () => {
    try {
      const { data } = await authApi.getLoginStatus();
      if (data.code === 0) {
        set({
          isLoggedIn: data.data.isLoggedIn,
          user: data.data.user || null,
          isLoading: false,
        });
      } else {
        // API 返回错误也要结束 loading 状态
        set({ isLoading: false });
      }
    } catch (error) {
      console.error("检查登录状态失败:", error);
      // 请求失败也要结束 loading 状态
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      console.log("开始退出登录...");
      const response = await authApi.logout();
      console.log("退出登录 API 响应:", response);

      // 立即更新本地状态
      set({ isLoggedIn: false, user: null, isLoading: false });
      console.log("退出登录成功，状态已更新");
    } catch (error) {
      console.error("退出登录失败:", error);
      // 即使出错也清除本地状态，避免卡住
      set({ isLoggedIn: false, user: null, isLoading: false });
      throw error; // 抛出错误以便前端可以显示提示
    }
  },
}));
