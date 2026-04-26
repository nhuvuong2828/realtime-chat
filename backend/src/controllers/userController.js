import User from "../models/User.js"; // Đổi đường dẫn model đúng với source của bạn
import Message from "../models/messageModel.js";

export const authMe = async (req, res) => {
  res.status(200).json(req.user);
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select("-password");
    res.status(200).json(users);
  } catch (error) { res.status(500).json({ message: "Lỗi server" }); }
};

export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ roomId }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) { res.status(500).json({ message: "Lỗi lấy tin nhắn" }); }
};

export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const users = await User.find({ username: { $regex: query, $options: "i" }, _id: { $ne: req.user._id } }).select("_id username");
    res.status(200).json(users);
  } catch (error) { res.status(500).json({ message: "Lỗi tìm kiếm" }); }
};

export const sendFriendRequest = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    await User.findByIdAndUpdate(targetUserId, { $addToSet: { friendRequests: req.user._id } });
    res.status(200).json({ message: "Đã gửi lời mời" });
  } catch (error) { res.status(500).json({ message: "Lỗi gửi lời mời" }); }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { senderId } = req.body;
    await User.findByIdAndUpdate(req.user._id, { $pull: { friendRequests: senderId }, $addToSet: { friends: senderId } });
    await User.findByIdAndUpdate(senderId, { $addToSet: { friends: req.user._id } });
    res.status(200).json({ message: "Đã kết bạn" });
  } catch (error) { res.status(500).json({ message: "Lỗi kết bạn" }); }
};

export const getFriendRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("friendRequests", "_id username avatar");
    res.status(200).json(user.friendRequests);
  } catch (error) { res.status(500).json({ message: "Lỗi danh sách lời mời" }); }
};

export const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("friends", "_id username avatar displayName bio");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    // 💡 BỘ LỌC THÔNG MINH: 
    // 1. Bỏ qua tài khoản lỗi (bóng ma)
    // 2. ẨN luân những người bạn đang nằm trong "Danh sách chặn"
    const validFriends = user.friends.filter(friend => {
      if (friend == null) return false;
      const isBlocked = user.blockedUsers.some(blockedId => blockedId.toString() === friend._id.toString());
      return !isBlocked; // Nếu bị chặn thì ẩn đi, không trả về Frontend
    });

    const friendsWithDetails = validFriends.map((friend) => ({
      _id: friend._id,
      username: friend.username,
      avatar: friend.avatar,
      displayName: friend.displayName,
      bio: friend.bio,
      nickname: (user.nicknames && user.nicknames.get) ? user.nicknames.get(friend._id.toString()) : null
    }));

    res.status(200).json(friendsWithDetails);
  } catch (error) { 
    console.error("🔴 Lỗi khi lấy danh sách bạn bè:", error); 
    res.status(500).json({ message: "Lỗi danh sách bạn bè" }); 
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { targetId } = req.body;
    await User.findByIdAndUpdate(req.user._id, { $pull: { friends: targetId } });
    await User.findByIdAndUpdate(targetId, { $pull: { friends: req.user._id } });
    res.status(200).json({ message: "Đã hủy kết bạn" });
  } catch (error) { res.status(500).json({ message: "Lỗi hủy kết bạn" }); }
};

export const setNickname = async (req, res) => {
  try {
    const { targetId, nickname } = req.body;
    const user = await User.findById(req.user._id);
    if (nickname.trim() === "") user.nicknames.delete(targetId);
    else user.nicknames.set(targetId, nickname);
    await user.save();
    res.status(200).json({ message: "Đã lưu biệt danh" });
  } catch (error) { res.status(500).json({ message: "Lỗi đặt biệt danh" }); }
};

export const blockUser = async (req, res) => {
  try {
    const { targetId } = req.body;
    
    // 💡 CHỈ THÊM VÀO DANH SÁCH CHẶN, KHÔNG XÓA KHỎI DANH SÁCH BẠN BÈ NỮA
    await User.findByIdAndUpdate(req.user._id, { 
      $addToSet: { blockedUsers: targetId } 
    });
    
    res.status(200).json({ message: "Đã chặn tin nhắn" });
  } catch (error) { 
    res.status(500).json({ message: "Lỗi chặn" }); 
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { displayName, bio, avatar } = req.body; 
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
        $set: { displayName: displayName || "", bio: bio || "", avatar: avatar || "" }
      }, { new: true }).select("-password"); 
    res.status(200).json({ message: "Thành công", user: updatedUser });
  } catch (error) { res.status(500).json({ message: "Lỗi cập nhật Profile" }); }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("blockedUsers", "_id username avatar displayName");
    res.status(200).json(user.blockedUsers);
  } catch (error) { res.status(500).json({ message: "Lỗi danh sách chặn" }); }
};

export const unblockUser = async (req, res) => {
  try {
    const { targetId } = req.body;
    await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: targetId } });
    res.status(200).json({ message: "Đã bỏ chặn" });
  } catch (error) { res.status(500).json({ message: "Lỗi bỏ chặn" }); }
};