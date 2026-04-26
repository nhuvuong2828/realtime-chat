import express from "express";
import { 
  authMe, getAllUsers, getMessages, searchUsers,
  sendFriendRequest, acceptFriendRequest, getFriendRequests, getFriends,
  removeFriend, setNickname, blockUser,
  updateProfile, getBlockedUsers, unblockUser
} from "../controllers/userController.js"; 

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

export default router;