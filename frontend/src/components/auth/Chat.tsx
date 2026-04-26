import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = "http://localhost:5001/api/users";
const SOCKET_URL = "http://localhost:5001";

interface ChatMessage {
  roomId: string;
  sender: string;
  text: string;
  image?: string;
  createdAt?: string;
}

interface User {
  _id: string;
  username: string;
  nickname?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
}

const Chat = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [imageAttachment, setImageAttachment] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentRoom, setCurrentRoom] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "search">("chats");
  
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const currentRoomRef = useRef(currentRoom);

  const [showMenu, setShowMenu] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]); 
  const [friendRequests, setFriendRequests] = useState<User[]>([]);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);

  // 💡 LẤY THÊM HÀM fetchMe TỪ STORE ĐỂ CẬP NHẬT LẠI THÔNG TIN BẢN THÂN
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token || (s as any).accessToken);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 💡 TỰ ĐỘNG ĐIỀN SẴN THÔNG TIN CŨ KHI MỞ BẢNG PROFILE
  useEffect(() => {
    if (showProfileModal && user) {
      setEditDisplayName(user.displayName || "");
      setEditBio(user.bio || "");
      setAvatarPreview(""); 
    }
  }, [showProfileModal, user]);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/friends`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setUsersList(await response.json());
    } catch (error) { console.error(error); }
  }, [token]);

  useEffect(() => { if (token && user?.username) fetchUsers(); }, [fetchUsers, token, user]);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await fetch(`${API_URL}/friend-requests`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) setFriendRequests(await response.json());
      } catch (error) { console.error(error); }
    };
    if (activeTab === "search") fetchRequests();
  }, [activeTab, token]);

  useEffect(() => {
    const fetchBlocked = async () => {
      try {
        const response = await fetch(`${API_URL}/blocked`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) setBlockedUsers(await response.json());
      } catch (error) { console.error(error); }
    };
    if (showBlockedModal) fetchBlocked();
  }, [showBlockedModal, token]);

  useEffect(() => {
    if (!token) return;
    const newSocket = io(SOCKET_URL, { auth: { token }, withCredentials: true });
    
    newSocket.on("receive_message", (data: ChatMessage) => {
      if (data.roomId === currentRoomRef.current) {
        setMessages((prev) => [...prev, data]);
      } 
      else {
        if (data.sender !== user?.username) { 
          setUnreadCounts((prev) => ({
            ...prev,
            [data.sender]: (prev[data.sender] || 0) + 1,
          }));
        }
      }
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [token, user?.username]);

  useEffect(() => {
    if (socket && user?.username && usersList.length > 0) {
      usersList.forEach((friend) => {
        const roomId = [user.username, friend.username].sort().join("_");
        socket.emit("join_room", roomId); 
      });
    }
  }, [socket, user?.username, usersList]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert("Ảnh quá lớn! Tối đa 5MB");
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setAvatarPreview(reader.result as string);
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: editDisplayName, bio: editBio, avatar: avatarPreview }),
      });
      
      if (res.ok) { 
        // 1. Lấy dữ liệu user mới tinh do Backend trả về
        const data = await res.json(); 
        
        alert("Cập nhật thành công!"); 
        setShowProfileModal(false); 
        fetchUsers(); 
        
        // 2. Ép Zustand cập nhật trực tiếp, dẹp hàm fetchMe qua một bên!
        useAuthStore.setState({ user: data.user }); 
      }
      else {
        alert("Lỗi cập nhật. Vui lòng thử lại.");
      }
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  const handleChatAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert("Ảnh quá lớn! Tối đa 5MB");
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setImageAttachment(reader.result as string);
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  const handleSendMessage = () => {
    if ((inputMessage.trim() || imageAttachment) && socket && currentRoom && selectedUser) {
      const messageData: ChatMessage = {
        roomId: currentRoom,
        sender: user?.username || "Ẩn danh",
        text: inputMessage,
        image: imageAttachment
      };
      socket.emit("send_message", messageData);
      setInputMessage("");
      setImageAttachment("");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(`${API_URL}/search?query=${searchQuery}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setSearchResults(await response.json());
    } catch (error) { console.error(error); }
  };

  const handleSendRequest = async (targetId: string) => {
    try {
      const res = await fetch(`${API_URL}/friend-request`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetUserId: targetId }) });
      if (res.ok) setSentRequests((prev) => [...prev, targetId]);
    } catch (error) { console.error(error); }
  };

  const handleAcceptRequest = async (senderId: string) => {
    try {
      const res = await fetch(`${API_URL}/accept-friend`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ senderId }) });
      if (res.ok) { setFriendRequests((prev) => prev.filter((req) => req._id !== senderId)); fetchUsers(); }
    } catch (error) { console.error(error); }
  };

  const handleUnfriend = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Hủy kết bạn?")) return;
    try {
      const res = await fetch(`${API_URL}/remove-friend`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId: selectedUser._id }) });
      if (res.ok) { setSelectedUser(null); fetchUsers(); setShowMenu(false); }
    } catch (error) { console.error(error); }
  };

  const handleBlock = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Chặn người này?")) return;
    try {
      const res = await fetch(`${API_URL}/block-user`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId: selectedUser._id }) });
      if (res.ok) { setSelectedUser(null); fetchUsers(); setShowMenu(false); }
    } catch (error) { console.error(error); }
  };

  const handleUpdateNickname = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API_URL}/set-nickname`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId: selectedUser._id, nickname: nicknameInput }) });
      if (res.ok) { setShowNicknameModal(false); fetchUsers(); setSelectedUser({ ...selectedUser, nickname: nicknameInput }); }
    } catch (error) { console.error(error); }
  };

  const handleSelectUser = async (target: User) => {
    setSelectedUser(target); setNicknameInput(target.nickname || "");
    const roomId = [user!.username, target.username].sort().join("_");
    socket?.emit("join_room", roomId); 
    setCurrentRoom(roomId); 
    setMessages([]);

    setUnreadCounts((prev) => {
      const newCounts = { ...prev };
      delete newCounts[target.username];
      return newCounts;
    });

    try {
      const response = await fetch(`${API_URL}/messages/${roomId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setMessages(await response.json());
    } catch (error) { console.error(error); }
  };

  const handleUnblock = async (targetId: string) => {
    try {
      const res = await fetch(`${API_URL}/unblock`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId }) });
      if (res.ok) setBlockedUsers((prev) => prev.filter(u => u._id !== targetId));
    } catch (error) { console.error(error); }
  };

  return (
    <div className="flex h-[600px] w-full max-w-5xl border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xl mx-auto mt-5 relative">
      
      {showNicknameModal && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-80">
            <h3 className="font-bold text-lg mb-4 text-gray-800">Đặt biệt danh</h3>
            <input type="text" className="w-full border p-2 rounded-lg mb-4 outline-none focus:border-blue-500" placeholder="Nhập biệt danh..." value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowNicknameModal(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Hủy</button>
              <button onClick={handleUpdateNickname} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl shadow-2xl w-96 max-w-[90%]">
            <h3 className="font-bold text-xl mb-4 text-gray-800 text-center">Hồ sơ của bạn</h3>
            <div className="flex flex-col items-center mb-6 relative">
              <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white shadow-md overflow-hidden flex items-center justify-center relative group cursor-pointer">
                {/* 💡 HIỂN THỊ ẢNH CỦA BẠN TRONG PROFILE */}
                {(avatarPreview || user?.avatar) ? (
                  <img src={avatarPreview || user?.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-gray-400 font-bold">{user?.username?.charAt(0).toUpperCase()}</span>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white text-xs font-medium">Đổi ảnh</span></div>
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleAvatarChange} />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setShowProfileModal(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold">Đóng</button>
              <button onClick={handleUpdateProfile} disabled={isUpdating} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50">{isUpdating ? "Đang lưu..." : "Lưu thay đổi"}</button>
            </div>
          </div>
        </div>
      )}

      {showBlockedModal && (
        <div className="absolute inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-96 max-w-[90%]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">Danh sách chặn</h3>
              <button onClick={() => setShowBlockedModal(false)} className="text-gray-400 hover:text-gray-800 font-bold text-xl">✕</button>
            </div>
            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {blockedUsers.length === 0 ? <p className="text-sm text-gray-500 text-center py-6">Bạn chưa chặn ai.</p> : (
                blockedUsers.map(u => (
                  <div key={u._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center font-bold overflow-hidden">
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm">{u.displayName || u.username}</span>
                        <span className="text-xs text-gray-500">@{u.username}</span>
                      </div>
                    </div>
                    <button onClick={() => handleUnblock(u._id)} className="px-3 py-1.5 bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-700 text-xs font-bold rounded-lg transition-colors">Bỏ chặn</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CỘT TRÁI */}
      <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            {/* 💡 HIỂN THỊ ẢNH AVATAR CỦA CHÍNH BẠN Ở GÓC TRÁI TRÊN CÙNG */}
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg overflow-hidden border border-gray-200">
              {user?.avatar ? (
                <img src={user.avatar} className="w-full h-full object-cover" />
              ) : (
                user?.username?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-gray-800">{user?.displayName || user?.username}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setShowBlockedModal(true)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors" title="Danh sách chặn">🛡️</button>
            <button onClick={() => setShowProfileModal(true)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors" title="Cập nhật hồ sơ">⚙️</button>
          </div>
        </div>

        <div className="flex bg-white border-b border-gray-200">
          <button onClick={() => setActiveTab("chats")} className={`flex-1 py-3 font-bold text-sm ${activeTab === "chats" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Đoạn chat</button>
          <button onClick={() => setActiveTab("search")} className={`flex-1 py-3 font-bold text-sm relative ${activeTab === "search" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>
            Tìm bạn {friendRequests.length > 0 && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "chats" ? (
            usersList.length === 0 ? <p className="text-gray-400 text-center text-sm mt-5">Chưa có bạn bè nào...</p> : (
              usersList.map((u) => {
                const unreadCount = unreadCounts[u.username] || 0;

                return (
                  <div key={u._id} onClick={() => handleSelectUser(u)} className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${selectedUser?._id === u._id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""}`}>
                    <div className="relative">
                      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg overflow-hidden">
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.username.charAt(0).toUpperCase()}
                      </div>
                      {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full flex items-center justify-center animate-bounce shadow-md">
                          <span className="absolute w-full h-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-hidden flex justify-between items-center">
                      <div className="overflow-hidden">
                        <div className={`truncate ${unreadCount > 0 ? "font-extrabold text-black" : "font-bold text-gray-800"}`}>
                          {u.nickname ? `${u.nickname} (${u.displayName || u.username})` : (u.displayName || u.username)}
                        </div>
                        <div className={`text-xs truncate ${unreadCount > 0 ? "text-blue-600 font-bold" : "text-gray-500 font-medium"}`}>
                          {unreadCount > 0 ? `Có ${unreadCount} tin nhắn mới...` : (u.bio || "Đang online")}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )
          ) : (
            <div className="p-4 flex flex-col gap-6">
              {friendRequests.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">Lời mời kết bạn <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{friendRequests.length}</span></h3>
                  <div className="flex flex-col gap-2">
                    {friendRequests.map((req) => (
                      <div key={req._id} className="flex flex-col p-3 bg-blue-50 border border-blue-100 rounded-xl shadow-sm gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">{req.username.charAt(0).toUpperCase()}</div>
                          <span className="font-bold text-gray-800 text-sm">{req.username}</span>
                        </div>
                        <button onClick={() => handleAcceptRequest(req._id)} className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">Đồng ý</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="font-bold text-sm text-gray-800 mb-3">Tìm kiếm bạn bè</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nhập tên..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                  <button onClick={handleSearch} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">Tìm</button>
                </div>
                <div className="flex flex-col gap-2 mt-3">
                  {searchResults.map((u) => {
                    const isSent = sentRequests.includes(u._id);
                    const isFriend = usersList.some(friend => friend._id === u._id);

                    return (
                      <div key={u._id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center font-bold text-sm">{u.username.charAt(0).toUpperCase()}</div>
                          <span className="font-bold text-gray-800 text-sm">{u.username}</span>
                        </div>
                        {isFriend ? (
                          <button disabled className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-600 cursor-not-allowed">Đã kết bạn</button>
                        ) : (
                          <button disabled={isSent} onClick={() => handleSendRequest(u._id)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSent ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white"}`}>{isSent ? "Đã gửi" : "Kết bạn"}</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CỘT PHẢI (Khung chat) */}
      <div className="w-2/3 flex flex-col bg-white">
        {!selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
            <div className="w-24 h-24 mb-4 opacity-50"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg></div>
            <p className="text-lg font-medium text-gray-500">Chọn một đoạn chat để bắt đầu</p>
          </div>
        ) : (
          <>
            <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold overflow-hidden">
                  {selectedUser.avatar ? <img src={selectedUser.avatar} className="w-full h-full object-cover" /> : selectedUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="font-bold text-gray-800 text-lg">{selectedUser.nickname || selectedUser.displayName || selectedUser.username}</div>
              </div>
              <div className="relative">
                <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 font-bold text-xl">⋮</button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-lg z-20 py-2">
                    <button onClick={() => { setShowNicknameModal(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">✏️ Đặt biệt danh</button>
                    <button onClick={handleUnfriend} className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2">💔 Hủy kết bạn</button>
                    <button onClick={handleBlock} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">🚫 Chặn tin nhắn</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto bg-[#e5ddd5]/30 flex flex-col gap-4">
              {messages.map((msg, index) => {
                const isMyMessage = msg.sender === user?.username;
                return (
                  <div key={index} className={`flex flex-col max-w-[70%] ${isMyMessage ? "self-end items-end" : "self-start items-start"}`}>
                    {msg.image && (
                      <div className="mb-1 rounded-xl overflow-hidden border-2 border-white shadow-sm max-w-[250px]">
                        <img src={msg.image} alt="attachment" className="w-full h-auto object-cover" />
                      </div>
                    )}
                    {msg.text && (
                      <div className={`px-4 py-2 rounded-2xl text-[15px] shadow-sm ${isMyMessage ? "bg-blue-600 text-white rounded-br-sm" : "bg-white border rounded-bl-sm"}`}>{msg.text}</div>
                    )}
                    <span className="text-[10px] text-gray-400 mt-1 mx-1">{new Date(msg.createdAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t flex flex-col gap-2">
              {imageAttachment && (
                <div className="relative w-24 h-24 mb-2">
                  <img src={imageAttachment} alt="preview" className="w-full h-full object-cover rounded-xl border-2 border-blue-500 shadow-md" />
                  <button onClick={() => setImageAttachment("")} className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-500">✕</button>
                </div>
              )}
              <div className="flex gap-3 items-center">
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors" title="Đính kèm ảnh">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleChatAttachment} className="hidden" />
                <input type="text" className="flex-1 px-5 py-3 bg-gray-100 rounded-full outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập tin nhắn..." value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} />
                <button onClick={handleSendMessage} className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-md hover:bg-blue-700 disabled:opacity-50" disabled={!inputMessage.trim() && !imageAttachment}>Gửi</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;