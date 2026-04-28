import Group from "../models/Group.js";
import User from "../models/User.js";

// 1. Tạo nhóm mới
export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body; 
    
    // Thêm chính mình (admin) vào danh sách thành viên
    const allMembers = [...members, req.user._id];

    const newGroup = await Group.create({
      name,
      admin: req.user._id,
      members: allMembers,
    });

    res.status(201).json(newGroup);
  } catch (error) {
    console.error("Lỗi tạo nhóm:", error);
    res.status(500).json({ message: "Lỗi khi tạo nhóm" });
  }
};

// 2. Lấy danh sách các nhóm mà mình đang tham gia
export const getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate("members", "_id username displayName avatar")
      .sort({ updatedAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    console.error("Lỗi lấy danh sách nhóm:", error);
    res.status(500).json({ message: "Lỗi lấy dữ liệu nhóm" });
  }
};