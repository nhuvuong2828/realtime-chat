import express from "express";
import { 
  authMe, getAllUsers, getMessages, searchUsers,
  sendFriendRequest, acceptFriendRequest, getFriendRequests, getFriends,
  removeFriend, setNickname, blockUser,
  updateProfile, getBlockedUsers, unblockUser,getConversations
} from "../controllers/userController.js"; 
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { createGroup, getMyGroups } from "../controllers/groupController.js";

const router = express.Router();

router.get("/me", authMe);
router.get("/", getAllUsers); 
router.get("/messages/:roomId", getMessages); 
router.get("/search", searchUsers); 
router.post("/friend-request", sendFriendRequest);
router.post("/accept-friend", acceptFriendRequest);
router.get("/friend-requests", getFriendRequests); 
router.get("/friends", getFriends); 
router.post("/remove-friend", removeFriend);
router.post("/set-nickname", setNickname);
router.post("/block-user", blockUser);
router.post("/profile", updateProfile);
router.get("/blocked", getBlockedUsers);
router.post("/unblock", unblockUser);
router.get("/conversations", protectedRoute, getConversations);

router.post("/groups", protectedRoute, createGroup);
router.get("/groups", protectedRoute, getMyGroups);

export default router;