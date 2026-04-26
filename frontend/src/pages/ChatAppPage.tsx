import Logout from "@/components/auth/Logout";
import { useAuthStore } from "@/stores/useAuthStore";
import Chat from "@/components/auth/Chat"; // Đảm bảo đường dẫn này khớp với nơi bạn tạo file Chat.tsx

const ChatAppPage = () => {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      {/* Thanh Header (Chứa tên user và nút đăng xuất) */}
      <div className="w-full max-w-4xl bg-white p-4 rounded-xl shadow-sm flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <span className="text-lg font-semibold text-gray-700">
            Xin chào, {user?.username} 👋
          </span>
        </div>
        <Logout />
      </div>

      {/* Hiển thị Khung Chat */}
      <Chat />
    </div>
  );
};

export default ChatAppPage;