import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true },
    sender: { type: String, required: true },
    text: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;