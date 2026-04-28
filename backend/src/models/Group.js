import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    avatar: { type: String, default: "" },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Người tạo nhóm
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Danh sách thành viên
    lastMessage: { type: String, default: "Nhóm vừa được tạo" },
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);