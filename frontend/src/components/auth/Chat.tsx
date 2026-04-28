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

// 💡 INTERFACE MỚI: Dành cho Group Chat
interface Group {
  _id: string;
  name: string;
  avatar?: string;
  admin: string;
  members: User[];
  lastMessage?: string;
}

const Chat = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [imageAttachment, setImageAttachment] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // STATE DANH SÁCH
  const [usersList, setUsersList] = useState<User[]>([]); 
  const [conversations, setConversations] = useState<User[]>([]); 
  const [groups, setGroups] = useState<Group[]>([]); // 💡 DANH SÁCH NHÓM

  // STATE ĐIỀU HƯỚNG CHAT
  const [chatType, setChatType] = useState<"user" | "group" | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [currentRoom, setCurrentRoom] = useState("");
  
  // 💡 THÊM TAB "groups" VÀO MENU
  const [activeTab, setActiveTab] = useState<"chats" | "groups" | "friends" | "search">("chats");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const currentRoomRef = useRef(currentRoom);

  // STATE UI & MODALS
  const [showMenu, setShowMenu] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]); 
  const [friendRequests, setFriendRequests] = useState<User[]>([]);

  const [showProfileModal, setShowProfileModal] = useState(false); 
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(null); 

  // 💡 STATE MODAL TẠO NHÓM
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);

  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token || (s as any).accessToken);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // FETCH DỮ LIỆU TỪ BACKEND
  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setConversations(await response.json());
    } catch (error) { console.error(error); }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/friends`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setUsersList(await response.json());
    } catch (error) { console.error(error); }
  }, [token]);

  // 💡 FETCH DANH SÁCH NHÓM
  const fetchGroups = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/groups`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setGroups(await response.json());
    } catch (error) { console.error(error); }
  }, [token]);

  useEffect(() => { 
    if (token && user?.username) {
      fetchUsers(); 
      fetchConversations();
      fetchGroups();
    }
  }, [fetchUsers, fetchConversations, fetchGroups, token, user]);

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

  // KHỞI TẠO SOCKET VÀ NHẬN TIN NHẮN
  useEffect(() => {
    if (!token) return;
    const newSocket = io(SOCKET_URL, { auth: { token }, withCredentials: true });
    const notificationSound = new Audio("/notification.mp3");

    newSocket.on("receive_message", (data: ChatMessage) => {
      if (data.sender !== user?.username) {
        notificationSound.play().catch(err => console.log("Trình duyệt chặn tự động phát âm thanh"));
      }

      if (data.roomId === currentRoomRef.current) {
        setMessages((prev) => [...prev, data]);
      } 
      else {
        if (data.sender !== user?.username) { 
          // Phân biệt Unread count cho Group và User
          const isGroup = !data.roomId.includes("_");
          const unreadKey = isGroup ? data.roomId : data.sender;

          setUnreadCounts((prev) => ({
            ...prev,
            [unreadKey]: (prev[unreadKey] || 0) + 1,
          }));
          
          if (!isGroup) fetchConversations();
        }
      }
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [token, user?.username, fetchConversations]);

  // JOIN TẤT CẢ PHÒNG ĐỂ NHẬN THÔNG BÁO (CẢ 1-1 VÀ NHÓM)
  useEffect(() => {
    if (socket && user?.username) {
      // Join phòng 1-1
      const allRelevantUsers = [...usersList, ...conversations];
      const uniqueUsernames = Array.from(new Set(allRelevantUsers.map(u => u.username)));
      uniqueUsernames.forEach((username) => {
        const roomId = [user.username, username].sort().join("_");
        socket.emit("join_room", roomId); 
      });

      // Join phòng Nhóm
      groups.forEach((g) => {
        socket.emit("join_room", g._id);
      });
    }
  }, [socket, user?.username, usersList, conversations, groups]);

  // CUỘN XUỐNG TIN NHẮN MỚI NHẤT
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
        const data = await res.json(); 
        alert("Cập nhật thành công!"); 
        setShowProfileModal(false); 
        fetchUsers(); 
        useAuthStore.setState({ user: data.user }); 
      }
      else { alert("Lỗi cập nhật. Vui lòng thử lại."); }
    } catch (error) { console.error(error); } finally { setIsUpdating(false); }
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

  // 💡 GỬI TIN NHẮN CHUNG CHO CẢ NHÓM VÀ 1-1
  const handleSendMessage = () => {
    if ((inputMessage.trim() || imageAttachment) && socket && currentRoom) {
      const messageData: ChatMessage = {
        roomId: currentRoom,
        sender: user?.username || "Ẩn danh",
        text: inputMessage,
        image: imageAttachment
      };
      socket.emit("send_message", messageData);
      setInputMessage("");
      setImageAttachment("");
      
      if (chatType === "user") fetchConversations();
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
      if (res.ok) { setFriendRequests((prev) => prev.filter((req) => req._id !== senderId)); fetchUsers(); fetchConversations(); }
    } catch (error) { console.error(error); }
  };

  const handleUnfriend = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Hủy kết bạn? Tin nhắn vẫn sẽ được giữ lại.")) return;
    try {
      const res = await fetch(`${API_URL}/remove-friend`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId: selectedUser._id }) });
      if (res.ok) { fetchUsers(); setShowMenu(false); }
    } catch (error) { console.error(error); }
  };

  const handleBlock = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Chặn người này?")) return;
    try {
      const res = await fetch(`${API_URL}/block-user`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId: selectedUser._id }) });
      if (res.ok) { 
        setSelectedUser(null); 
        setChatType(null);
        fetchUsers(); 
        fetchConversations(); 
        setShowMenu(false); 
      }
    } catch (error) { console.error(error); }
  };

  const handleUpdateNickname = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API_URL}/set-nickname`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId: selectedUser._id, nickname: nicknameInput }) });
      if (res.ok) { setShowNicknameModal(false); fetchUsers(); fetchConversations(); setSelectedUser({ ...selectedUser, nickname: nicknameInput }); }
    } catch (error) { console.error(error); }
  };

  const handleUnblock = async (targetId: string) => {
    try {
      const res = await fetch(`${API_URL}/unblock`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetId }) });
      if (res.ok) {
        setBlockedUsers((prev) => prev.filter(u => u._id !== targetId));
        fetchConversations(); 
      }
    } catch (error) { console.error(error); }
  };

  // 💡 CHỌN CHAT 1-1
  const handleSelectUser = async (target: User) => {
    setChatType("user");
    setSelectedUser(target); 
    setSelectedGroup(null);
    setNicknameInput(target.nickname || "");
    
    const roomId = [user!.username, target.username].sort().join("_");
    socket?.emit("join_room", roomId); 
    setCurrentRoom(roomId); 
    setMessages([]);

    setUnreadCounts((prev) => { const newCounts = { ...prev }; delete newCounts[target.username]; return newCounts; });

    try {
      const response = await fetch(`${API_URL}/messages/${roomId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setMessages(await response.json());
    } catch (error) { console.error(error); }
  };

  // 💡 CHỌN CHAT NHÓM
  const handleSelectGroup = async (group: Group) => {
    setChatType("group");
    setSelectedGroup(group);
    setSelectedUser(null);
    
    socket?.emit("join_room", group._id); 
    setCurrentRoom(group._id); 
    setMessages([]);

    setUnreadCounts((prev) => { const newCounts = { ...prev }; delete newCounts[group._id]; return newCounts; });

    try {
      const response = await fetch(`${API_URL}/messages/${group._id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setMessages(await response.json());
    } catch (error) { console.error(error); }
  };

  // 💡 XỬ LÝ TẠO NHÓM
  const toggleMemberSelection = (userId: string) => {
    setSelectedMembers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleCreateGroup = async () => {
    if (!groupNameInput.trim()) return alert("Vui lòng nhập tên nhóm!");
    if (selectedMembers.length === 0) return alert("Vui lòng chọn ít nhất 1 thành viên!");

    try {
      const res = await fetch(`${API_URL}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: groupNameInput, members: selectedMembers })
      });
      if (res.ok) {
        alert("Tạo nhóm thành công!");
        setShowCreateGroupModal(false);
        setGroupNameInput("");
        setSelectedMembers([]);
        fetchGroups();
        setActiveTab("groups");
      } else {
        alert("Lỗi tạo nhóm.");
      }
    } catch (error) { console.error(error); }
  };


  const isFriendWithSelected = selectedUser && usersList.some(f => f._id === selectedUser._id);

  return (
    <div className="flex h-[600px] w-full max-w-5xl border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xl mx-auto mt-5 relative">
      
      {/* 💡 MODAL TẠO NHÓM */}
      {showCreateGroupModal && (
        <div className="absolute inset-0 bg-black/60 z-[80] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-96 flex flex-col max-h-[80%]">
            <h3 className="font-bold text-xl mb-4 text-gray-800 text-center border-b pb-2">Tạo Nhóm Mới</h3>
            
            <input type="text" className="w-full border border-gray-300 p-3 rounded-xl mb-4 outline-none focus:border-blue-500 font-bold" placeholder="Nhập tên nhóm..." value={groupNameInput} onChange={(e) => setGroupNameInput(e.target.value)} />
            
            <h4 className="text-sm font-bold text-gray-500 mb-2">Chọn thành viên ({selectedMembers.length}):</h4>
            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl p-2 mb-4 bg-gray-50">
              {usersList.length === 0 ? (
                <p className="text-xs text-gray-400 text-center mt-4">Bạn chưa có bạn bè nào để thêm.</p>
              ) : (
                usersList.map(u => (
                  <div key={u._id} onClick={() => toggleMemberSelection(u._id)} className="flex items-center gap-3 p-2 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
                    <input type="checkbox" checked={selectedMembers.includes(u._id)} readOnly className="w-4 h-4 cursor-pointer accent-blue-600" />
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover rounded-full"/> : u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-gray-700 text-sm truncate">{u.displayName || u.username}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setShowCreateGroupModal(false); setSelectedMembers([]); setGroupNameInput("");}} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold">Hủy</button>
              <button onClick={handleCreateGroup} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">Tạo Nhóm</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM PROFILE NGƯỜI KHÁC */}
      {viewingProfileUser && (
        <div className="absolute inset-0 bg-black/60 z-[70] flex items-center justify-center backdrop-blur-sm" onClick={() => setViewingProfileUser(null)}>
          <div className="bg-white p-6 rounded-3xl shadow-2xl w-96 max-w-[90%] relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewingProfileUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl transition-colors">✕</button>
            <h3 className="font-bold text-xl mb-4 text-gray-800 text-center border-b pb-3">Hồ sơ</h3>
            <div className="flex flex-col items-center mb-6">
              <div className="w-28 h-28 rounded-full bg-blue-100 text-blue-600 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center font-bold text-4xl mb-3">
                {viewingProfileUser.avatar ? <img src={viewingProfileUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : viewingProfileUser.username.charAt(0).toUpperCase()}
              </div>
              <h2 className="font-extrabold text-2xl text-gray-800 text-center">{viewingProfileUser.displayName || viewingProfileUser.username}</h2>
              <p className="text-sm text-gray-500 font-medium">@{viewingProfileUser.username}</p>
              {viewingProfileUser.nickname && <div className="mt-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">Biệt danh: {viewingProfileUser.nickname}</div>}
            </div>
            <div className="flex flex-col gap-3 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-inner">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tiểu sử</label>
                <p className="text-sm text-gray-800 mt-1 italic min-h-[40px]">{viewingProfileUser.bio ? `"${viewingProfileUser.bio}"` : "Người này chưa cập nhật tiểu sử."}</p>
              </div>
            </div>
            <button onClick={() => setViewingProfileUser(null)} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors">Đóng</button>
          </div>
        </div>
      )}

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
                {(avatarPreview || user?.avatar) ? <img src={avatarPreview || user?.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-3xl text-gray-400 font-bold">{user?.username?.charAt(0).toUpperCase()}</span>}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white text-xs font-medium">Đổi ảnh</span></div>
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleAvatarChange} />
              </div>
            </div>
            <div className="flex flex-col gap-3 mb-6">
              <div>
                <label className="text-xs font-bold text-gray-500 ml-1">Tên hiển thị</label>
                <input type="text" className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none focus:border-blue-500" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 ml-1">Tiểu sử</label>
                <textarea className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none focus:border-blue-500 resize-none h-20" value={editBio} onChange={(e) => setEditBio(e.target.value)} />
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
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setViewingProfileUser(u)}>
                      <div className="w-10 h-10 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center font-bold overflow-hidden group-hover:opacity-80 transition-opacity">
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors">{u.displayName || u.username}</span>
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

      {/* ======================================================== */}
      {/* CỘT TRÁI */}
      {/* ======================================================== */}
      <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
        <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg overflow-hidden border border-gray-200">
              {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user?.username?.charAt(0).toUpperCase()}
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

        {/* 4 TABS MENU */}
        <div className="flex bg-white border-b border-gray-200 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab("chats")} className={`flex-1 py-3 font-bold text-xs whitespace-nowrap px-2 ${activeTab === "chats" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Cá nhân</button>
          <button onClick={() => setActiveTab("groups")} className={`flex-1 py-3 font-bold text-xs whitespace-nowrap px-2 ${activeTab === "groups" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Nhóm</button>
          <button onClick={() => setActiveTab("friends")} className={`flex-1 py-3 font-bold text-xs whitespace-nowrap px-2 ${activeTab === "friends" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>Bạn bè</button>
          <button onClick={() => setActiveTab("search")} className={`flex-1 py-3 font-bold text-xs whitespace-nowrap px-2 relative ${activeTab === "search" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>
            Tìm kiếm {friendRequests.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* TAB: CÁ NHÂN */}
          {activeTab === "chats" && (
            conversations.length === 0 ? <p className="text-gray-400 text-center text-sm mt-5">Chưa có cuộc trò chuyện nào...</p> : (
              conversations.filter(u => !blockedUsers.some(b => b._id === u._id)).map((u) => {
                const unreadCount = unreadCounts[u.username] || 0;
                return (
                  <div key={u._id} onClick={() => handleSelectUser(u)} className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${selectedUser?._id === u._id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""}`}>
                    <div className="relative cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); setViewingProfileUser(u); }} title="Xem hồ sơ">
                      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg overflow-hidden">
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.username.charAt(0).toUpperCase()}
                      </div>
                      {unreadCount > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full flex items-center justify-center animate-bounce shadow-md"><span className="absolute w-full h-full rounded-full bg-green-400 opacity-75 animate-ping"></span></div>}
                    </div>
                    <div className="flex-1 overflow-hidden flex justify-between items-center">
                      <div className="overflow-hidden">
                        <div className={`truncate ${unreadCount > 0 ? "font-extrabold text-black" : "font-bold text-gray-800"}`}>{u.nickname ? `${u.nickname} (${u.displayName || u.username})` : (u.displayName || u.username)}</div>
                        <div className={`text-xs truncate ${unreadCount > 0 ? "text-blue-600 font-bold" : "text-gray-500 font-medium"}`}>Đã từng trò chuyện</div>
                      </div>
                    </div>
                  </div>
                )
              })
            )
          )}

          {/* 💡 TAB: NHÓM CHAT */}
          {activeTab === "groups" && (
            <div className="flex flex-col">
              <div className="p-3 border-b bg-gray-50 flex justify-center">
                <button onClick={() => setShowCreateGroupModal(true)} className="w-full py-2 bg-blue-100 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-600 hover:text-white transition-colors border border-blue-200">
                  + Tạo Nhóm Mới
                </button>
              </div>
              {groups.length === 0 ? (
                <p className="text-gray-400 text-center text-sm mt-5">Bạn chưa tham gia nhóm nào.</p>
              ) : (
                groups.map(g => {
                  const unreadCount = unreadCounts[g._id] || 0;
                  return (
                    <div key={g._id} onClick={() => handleSelectGroup(g)} className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${selectedGroup?._id === g._id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""}`}>
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-500 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm">
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        {unreadCount > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full flex items-center justify-center animate-bounce shadow-md"><span className="absolute w-full h-full rounded-full bg-green-400 opacity-75 animate-ping"></span></div>}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className={`truncate ${unreadCount > 0 ? "font-extrabold text-black" : "font-bold text-gray-800"}`}>{g.name}</div>
                        <div className={`text-xs truncate ${unreadCount > 0 ? "text-blue-600 font-bold" : "text-gray-500 font-medium"}`}>Thành viên: {g.members.length}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB: BẠN BÈ */}
          {activeTab === "friends" && (
            <div className="p-4 flex flex-col gap-4">
              <h3 className="font-bold text-sm text-gray-800 border-b pb-2">Danh bạ ({usersList.length})</h3>
              {usersList.length === 0 ? <p className="text-gray-400 text-center text-sm mt-5">Bạn chưa kết bạn với ai.</p> : (
                <div className="flex flex-col gap-3">
                  {usersList.map((u) => (
                    <div key={u._id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 overflow-hidden cursor-pointer group flex-1" onClick={() => setViewingProfileUser(u)} title="Xem hồ sơ">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg overflow-hidden shrink-0 group-hover:opacity-80 transition-opacity">
                          {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="font-bold text-gray-800 text-sm truncate group-hover:text-blue-600 transition-colors">{u.displayName || u.username}</span>
                          <span className="text-xs text-gray-500 truncate">{u.nickname ? `Biệt danh: ${u.nickname}` : `@${u.username}`}</span>
                        </div>
                      </div>
                      <button onClick={() => { handleSelectUser(u); setActiveTab("chats"); }} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors shrink-0 ml-2">Nhắn</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: TÌM BẠN */}
          {activeTab === "search" && (
            <div className="p-4 flex flex-col gap-6">
              {friendRequests.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">Lời mời kết bạn <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{friendRequests.length}</span></h3>
                  <div className="flex flex-col gap-2">
                    {friendRequests.map((req) => (
                      <div key={req._id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 cursor-pointer group flex-1" onClick={() => setViewingProfileUser(req)} title="Xem hồ sơ">
                          <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 group-hover:opacity-80 transition-opacity">
                            {req.avatar ? <img src={req.avatar} className="w-full h-full object-cover" /> : req.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors truncate">{req.displayName || req.username}</span>
                            <span className="text-xs text-gray-500 truncate">@{req.username}</span>
                          </div>
                        </div>
                        <button onClick={() => handleAcceptRequest(req._id)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shrink-0 ml-2">Đồng ý</button>
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
                      <div key={u._id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 cursor-pointer group flex-1" onClick={() => setViewingProfileUser(u)} title="Xem hồ sơ">
                          <div className="w-10 h-10 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 group-hover:opacity-80 transition-opacity">
                            {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors truncate">{u.displayName || u.username}</span>
                            <span className="text-xs text-gray-500 truncate">@{u.username}</span>
                          </div>
                        </div>
                        <div className="shrink-0 ml-2">
                          {isFriend ? <button disabled className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-600 cursor-not-allowed">Đã kết bạn</button> : <button disabled={isSent} onClick={() => handleSendRequest(u._id)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSent ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white"}`}>{isSent ? "Đã gửi" : "Kết bạn"}</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* CỘT PHẢI (KHUNG CHAT) */}
      {/* ======================================================== */}
      <div className="w-2/3 flex flex-col bg-white">
        {!chatType ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
            <div className="w-24 h-24 mb-4 opacity-50"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg></div>
            <p className="text-lg font-medium text-gray-500">Chọn một cuộc trò chuyện để bắt đầu</p>
          </div>
        ) : (
          <>
            {/* HEADER KHUNG CHAT (Thay đổi linh hoạt dựa theo Chat 1-1 hay Chat Nhóm) */}
            <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                {chatType === "user" && selectedUser && (
                  <>
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold overflow-hidden cursor-pointer hover:opacity-80 shadow-sm" onClick={() => setViewingProfileUser(selectedUser)}>
                      {selectedUser.avatar ? <img src={selectedUser.avatar} className="w-full h-full object-cover" /> : selectedUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-bold text-gray-800 text-lg">{selectedUser.nickname || selectedUser.displayName || selectedUser.username}</div>
                  </>
                )}
                {chatType === "group" && selectedGroup && (
                  <>
                    <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-500 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
                      {selectedGroup.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-lg">{selectedGroup.name}</span>
                      <span className="text-xs text-gray-500">{selectedGroup.members.length} thành viên</span>
                    </div>
                  </>
                )}
              </div>
              
              {/* MENU 3 CHẤM (Chỉ cho chat 1-1) */}
              {chatType === "user" && isFriendWithSelected && (
                <div className="relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 font-bold text-xl">⋮</button>
                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-lg z-20 py-2">
                      <button onClick={() => { setShowNicknameModal(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">✏️ Đặt biệt danh</button>
                      <button onClick={handleUnfriend} className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50">💔 Hủy kết bạn</button>
                      <button onClick={handleBlock} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">🚫 Chặn tin nhắn</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* NỘI DUNG TIN NHẮN */}
            <div className="flex-1 p-5 overflow-y-auto bg-[#e5ddd5]/30 flex flex-col gap-4">
              {messages.map((msg, index) => {
                const isMyMessage = msg.sender === user?.username;
                return (
                  <div key={index} className={`flex flex-col max-w-[70%] ${isMyMessage ? "self-end items-end" : "self-start items-start"}`}>
                    {/* 💡 TRONG NHÓM: HIỂN THỊ TÊN NGƯỜI GỬI NẾU KHÔNG PHẢI MÌNH */}
                    {chatType === "group" && !isMyMessage && (
                      <span className="text-[10px] text-gray-500 font-bold ml-1 mb-1">{msg.sender}</span>
                    )}

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

            {/* KHU VỰC NHẬP TIN NHẮN */}
            <div className="p-4 bg-white border-t flex flex-col gap-2">
              {chatType === "group" || isFriendWithSelected ? (
                <>
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
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 bg-gray-50 rounded-xl border border-gray-100 mt-2">
                  <span className="text-sm text-gray-500 font-medium mb-3">Bạn không thể nhắn tin vì hai người chưa kết bạn.</span>
                  {selectedUser && (
                    <button 
                      disabled={sentRequests.includes(selectedUser._id)}
                      onClick={() => handleSendRequest(selectedUser._id)}
                      className={`px-5 py-2 rounded-full text-xs font-bold transition-colors ${sentRequests.includes(selectedUser._id) ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"}`}
                    >
                      {sentRequests.includes(selectedUser._id) ? "Đã gửi lời mời kết bạn" : "Gửi lời mời kết bạn"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;