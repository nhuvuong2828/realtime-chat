import { create } from "zustand";
import { persist } from "zustand/middleware"; // <-- Import thêm vũ khí bí mật này
import { toast } from "sonner";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },
      clearState: () => {
        set({ accessToken: null, user: null, loading: false });
      },

      signUp: async (username, password, email, firstName, lastName) => {
        try {
          set({ loading: true });
          await authService.signUp(username, password, email, firstName, lastName);
          toast.success("Đăng ký thành công! Bạn sẽ được chuyển sang trang đăng nhập.");
        } catch (error) {
          console.error(error);
          toast.error("Đăng ký không thành công");
        } finally {
          set({ loading: false });
        }
      },

      signIn: async (username, password) => {
        try {
          set({ loading: true });

          // 🛠 SỬA TẠI ĐÂY: Lấy luôn cả accessToken và user từ kết quả trả về
          const response = await authService.signIn(username, password);
          
          set({ 
            accessToken: response.accessToken,
            user: response.user // Gán thẳng user, không cần gọi fetchMe() nữa
          });

          toast.success("Chào mừng bạn quay lại với Moji 🎉");
        } catch (error) {
          console.error(error);
          toast.error("Đăng nhập không thành công!");
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          get().clearState();
          await authService.signOut();
          toast.success("Logout thành công!");
        } catch (error) {
          console.error(error);
          toast.error("Lỗi xảy ra khi logout. Hãy thử lại!");
        }
      },

      fetchMe: async () => {
        try {
          set({ loading: true });
          const user = await authService.fetchMe();
          set({ user });
        } catch (error) {
          console.error(error);
          set({ user: null, accessToken: null });
        } finally {
          set({ loading: false });
        }
      },

      refresh: async () => {
        try {
          set({ loading: true });
          const { user, fetchMe, setAccessToken } = get();
          const accessToken = await authService.refresh();

          setAccessToken(accessToken);

          if (!user) {
            await fetchMe();
          }
        } catch (error) {
          console.error(error);
          get().clearState();
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage", // 🛠 SỬA TẠI ĐÂY: Tên ổ cứng ảo lưu trữ trạng thái để F5 không bị mất
    }
  )
);