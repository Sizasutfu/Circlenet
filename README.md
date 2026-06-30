# Circle App - Backend API Documentation

**Last Updated:** May 28, 2026  

---

## Table of Contents

1. [Authentication](#authentication)
2. [Admin Management](#admin-management)
3. [User Management](#user-management)
4. [Posts & Interactions](#posts--interactions)
5. [Direct Messages (DM)](#direct-messages-dm)
6. [Notifications](#notifications)
7. [Search](#search)
8. [Follow System](#follow-system)
9. [Topics](#topics)
10. [Groups](#groups)
11. [Articles](#articles)
12. [Recommendations](#recommendations)
13. [Explore](#explore)
14. [Push Notifications](#push-notifications)
15. [Phone Authentication](#phone-authentication)
16. [Link Preview](#link-preview)

---

## Authentication

### Phone Authentication

#### Send OTP for Login
```
POST /api/auth/phone/send-otp
```
Send OTP to existing phone number for login.

#### Verify OTP for Login
```
POST /api/auth/phone/verify-otp
```
Verify OTP and login. Returns user object.

#### Send OTP for Registration
```
POST /api/auth/phone/register/send-otp
```
Send OTP for new account registration (validates phone not already taken).

#### Verify OTP for Registration
```
POST /api/auth/phone/register/verify-otp
```
Verify OTP and create new account. Returns user object.

---

## Admin Management
**Base Path:** `/api/admin`  
**Authentication:** `requireAdmin` middleware required (except login)

#### Admin Login
```
POST /api/admin/login
```
Login to admin panel.

#### Admin Logout
```
POST /api/admin/logout
Authorization Required: Admin
```

### Dashboard

#### Get Statistics
```
GET /api/admin/stats
Authorization Required: Admin
```
Get dashboard statistics.

#### Get Charts Data
```
GET /api/admin/charts
Authorization Required: Admin
```
Get chart data for dashboard visualization.

### User Management

#### Get All Users
```
GET /api/admin/users
Authorization Required: Admin
```

#### Suspend User
```
PUT /api/admin/users/:id/suspend
Authorization Required: Admin
```
Suspend a user account.

#### Unsuspend User
```
PUT /api/admin/users/:id/unsuspend
Authorization Required: Admin
```
Restore a suspended user account.

#### Delete User
```
DELETE /api/admin/users/:id
Authorization Required: Admin
```

### Post Management

#### Get All Posts
```
GET /api/admin/posts
Authorization Required: Admin
```

#### Delete Post
```
DELETE /api/admin/posts/:id
Authorization Required: Admin
```

### Reports Management

#### Create Report
```
POST /api/admin/reports
Authorization Required: Authenticated User
```
Report content (from main app users).

#### Get All Reports
```
GET /api/admin/reports
Authorization Required: Admin
```

#### Resolve Report
```
PUT /api/admin/reports/:id/resolve
Authorization Required: Admin
```

#### Ignore Report
```
PUT /api/admin/reports/:id/ignore
Authorization Required: Admin
```

### Settings

#### Update Admin Password
```
PUT /api/admin/settings/password
Authorization Required: Admin
```

---

## User Management
**Base Path:** `/api/users`

### Registration & Login

#### Register User
```
POST /api/users/register
```
Create a new user account.

#### Login User
```
POST /api/users/login
```
Login with email/phone credentials.

### Profile Management

#### Get User Profile
```
GET /api/users/:id/profile
```
Public endpoint to get user profile information.

#### Search Users
```
GET /api/users?search=<query>&limit=8
Authorization Required: Authenticated
```
Search for users by username or name.

#### Get New Members
```
GET /api/users/new-members?limit=10
```
Get users who joined in the last 7 days.

#### Update Profile
```
PUT /api/users/:id
Authorization Required: Authenticated
Body: { ...profile_fields }
```
Update user profile information.

#### Update Profile Picture
```
PUT /api/users/:id/picture
Authorization Required: Authenticated
Content-Type: multipart/form-data
Body: { image: <file> }
```

#### Update Cover Image
```
PUT /api/users/:id/cover
Authorization Required: Authenticated
Content-Type: multipart/form-data
Body: { image: <file> }
```

#### Update Username
```
PUT /api/users/:id/username
Authorization Required: Authenticated
Body: { username: "<new_username>" }
```

### E2E Encryption Keys

#### Get Public Key
```
GET /api/users/:id/publickey
Response: { publicKey: "<base64_spki>" | null }
```

#### Set Public Key
```
PUT /api/users/:id/publickey
Authorization Required: Authenticated
Body: { publicKey: "<base64_spki>" }
```

### Password Reset

#### Request Password Reset
```
POST /api/users/reset-password
Body: { email }
```
Send password reset email.

#### Confirm Password Reset
```
POST /api/users/reset-password/confirm
Body: { token, newPassword }
```

### Email Verification

#### Send Verification Email
```
POST /api/users/email/send-verification
```

#### Verify Email
```
POST /api/users/email/verify
Body: { token }
```

### Follow Lists (Aliases)

#### Get User's Following
```
GET /api/users/:id/following
```
Alias for `/api/following/:userId`

#### Get User's Followers
```
GET /api/users/:id/followers
```
Alias for `/api/followers/:userId`

---

## Posts & Interactions
**Base Path:** `/api/posts`

### Feed & CRUD

#### Get Posts (Feed)
```
GET /api/posts?viewerId=<optional_id>&skip=0&limit=20
```
Get feed of posts (viewerId optional for personalization).

#### Create Post
```
POST /api/posts
Authorization Required: Authenticated
Content-Type: multipart/form-data
Body:
{
  text: "<post_content>",
  image: <optional_file>,
  video: <optional_file>
}
```

#### Get Post by ID
```
GET /api/posts/:id
```

#### Update Post
```
PUT /api/posts/:id
Authorization Required: Authenticated
Body: { text, ... }
```

#### Delete Post
```
DELETE /api/posts/:id
Authorization Required: Authenticated
```

### Interactions

#### Toggle Like
```
POST /api/posts/:id/like
Authorization Required: Authenticated
```
Like or unlike a post.

#### Add Comment
```
POST /api/posts/:id/comment
Authorization Required: Authenticated
Body: { text: "<comment_text>" }
```

#### Repost
```
POST /api/posts/:id/repost
Authorization Required: Authenticated
```
Repost (share) a post.

#### Record View
```
POST /api/posts/:id/view
Authorization Optional (guests tracked by fingerprint)
```

#### Record Skip
```
POST /api/posts/:id/skip
Authorization Required: Authenticated
```
Record when user skips a post (for feed algorithm).

---

## Direct Messages (DM)
**Base Path:** `/api/dm`  
**Authentication:** All routes require `requireAuth`

### Presence & Heartbeat

#### Send Heartbeat
```
POST /api/dm/heartbeat
```
Touch `last_seen_at` — call every 30 seconds to indicate active presence.

#### Get Presence
```
GET /api/dm/conversations/:conversationId/presence
Response: { online: boolean, last_seen_at: timestamp }
```
Get online status of other user in conversation.

### Inbox Management

#### Get Inbox
```
GET /api/dm/inbox
Response: [{ conversationId, recipientId, lastMessage, unreadCount, ... }]
```
List all conversations for current user.

#### Get Unread Count
```
GET /api/dm/unread-count
Response: { count: number }
```
Badge count for navigation.

### Conversations

#### Open/Create Conversation
```
POST /api/dm/conversations
Body: { recipientId: number }
Response: { conversationId, ... }
```
Open or find a 1-to-1 conversation with a user.

### Messages

#### Get Messages (Paginated)
```
GET /api/dm/conversations/:conversationId/messages?limit=10&before_id=<optional_id>
Response: [{ id, senderId, text, encryptedContent, timestamp, ... }]
```
Fetch thread of messages. Omit `before_id` on first load.

#### Get New Messages
```
GET /api/dm/conversations/:conversationId/messages/new?after_id=<id>
```
Polling endpoint — only returns messages after given ID (for real-time updates).

#### Send Message
```
POST /api/dm/conversations/:conversationId/messages
Body: { text: "<message>", encryptedContent: "<optional_e2e>" }
```

#### Mark Conversation as Read
```
PATCH /api/dm/conversations/:conversationId/read
```
Mark all messages in conversation as read.

#### Get Read Status
```
POST /api/dm/read-status
Body: { ids: [msg_id1, msg_id2, ...] }
Response: { readIds: [...] }
```
Check which messages have been read.

---

## Notifications
**Base Path:** `/api/notifications`

#### Get Notifications
```
GET /api/notifications/:userId
Response: [{ id, type, actor, content, timestamp, ... }]
```

#### Get Unread Count
```
GET /api/notifications/:userId/unread-count
Response: { count: number }
```

#### Mark All as Read
```
PUT /api/notifications/:userId/read-all
```

#### Mark One as Read
```
PUT /api/notifications/:id/read
```

---

## Search
**Base Path:** `/api/search`

#### Search
```
GET /api/search?q=<search_term>&type=posts|people&limit=10
```
Search for posts and people. Supports Elasticsearch.

---

## Follow System
**Base Path:** `/api` (mounted directly)

### Follow/Unfollow

#### Follow User
```
POST /api/follow/:targetId
Authorization Required: Authenticated
```

#### Unfollow User
```
DELETE /api/unfollow/:targetId
Authorization Required: Authenticated
```

### Follow Lists

#### Get Followers
```
GET /api/followers/:userId
Response: [{ id, username, avatar, ... }]
```

#### Get Following
```
GET /api/following/:userId
Response: [{ id, username, avatar, ... }]
```

---

## Topics
**Base Path:** `/api/topics`

#### Get All Topics
```
GET /api/topics
```

#### Get My Topics
```
GET /api/topics/mine
Authorization Required: Authenticated
```
Get topics the current user follows.

#### Get Topic Feed
```
GET /api/topics/feed
Authorization Required: Authenticated
```
Get personalized feed based on followed topics.

#### Get Posts by Topic
```
GET /api/topics/:topic/posts
Response: [{ id, text, author, ... }]
```

#### Follow Topic
```
POST /api/topics/:topic/follow
Authorization Required: Authenticated
```

#### Unfollow Topic
```
DELETE /api/topics/:topic/follow
Authorization Required: Authenticated
```

---

## Groups
**Base Path:** `/api/groups`

#### Get Trending Groups
```
GET /api/groups
```

#### Get My Groups
```
GET /api/groups/mine
Authorization Required: Authenticated
```

#### Get Group by Topic
```
GET /api/groups/topic/:topic
```

#### Get Group Details
```
GET /api/groups/:groupId
```

#### Get Group Feed
```
GET /api/groups/:groupId/feed
```

### Membership

#### Join Group
```
POST /api/groups/:groupId/join
Authorization Required: Authenticated
```

#### Leave Group
```
DELETE /api/groups/:groupId/join
Authorization Required: Authenticated
```

---

## Articles
**Base Path:** `/api/articles`

### Read

#### Get Articles (List)
```
GET /api/articles
```

#### Get Article by ID
```
GET /api/articles/:id
```

#### Get Article by Slug
```
GET /api/articles/by-slug/:slug
```

#### Get All Tags
```
GET /api/articles/tags
```

### Write (Admin Only)

#### Create Article
```
POST /api/articles
Authorization Required: Admin
Content-Type: multipart/form-data
Body:
{
  title: "<title>",
  content: "<markdown_content>",
  slug: "<url-slug>",
  image: <optional_file>,
  tags: "<comma,separated,tags>"
}
```

#### Update Article
```
PUT /api/articles/:id
Authorization Required: Admin
Content-Type: multipart/form-data
Body: { title, content, slug, image, tags, ... }
```

#### Delete Article
```
DELETE /api/articles/:id
Authorization Required: Admin
```

### Interactions

#### Toggle Like
```
POST /api/articles/:id/like
Authorization Required: Authenticated
```

#### Toggle Echo
```
POST /api/articles/:id/echo
Authorization Required: Authenticated
```

#### Add Comment
```
POST /api/articles/:id/comment
Authorization Required: Authenticated
Body: { text: "<comment_text>" }
```

---

## Recommendations
**Base Path:** `/api/recommendations`

#### Get Recommendations
```
GET /api/recommendations?userId=<id>
Response: [{ id, username, avatar, reason, ... }]
```
Get recommended users to follow.

---

## Explore
**Base Path:** `/api/explore`

#### Get Trending
```
GET /api/explore/trending
Response: { trending_posts: [...], trending_people: [...], trending_topics: [...] }
```

---

## Push Notifications
**Base Path:** `/api/push`

#### Subscribe to Push
```
POST /api/push/subscribe
Body:
{
  userId: number,
  subscription:
  {
    endpoint: "<push_endpoint>",
    keys: { p256dh: "<key>", auth: "<key>" }
  },
  preferences: { likes: true, comments: true, ... }
}
Response: { message: "Subscribed." }
```

#### Unsubscribe from Push
```
POST /api/push/unsubscribe
Body: { endpoint: "<push_endpoint>" }
```

#### Update Push Preferences
```
POST /api/push/preferences
Body:
{
  endpoint: "<push_endpoint>",
  preferences: { likes: true, comments: false, ... }
}
```

---

## Link Preview
**Base Path:** `/api/link-preview`

#### Get Link Preview
```
GET /api/link-preview?url=<full_url>
Response:
{
  title: "<page_title>",
  description: "<meta_description>",
  image: "<og_image_url>"
}
```
Scrapes OG tags from URL. Special handling for Twitter/X with oEmbed API.

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message"
}
```

Common HTTP Status Codes:
- `200 OK` — Request successful
- `201 Created` — Resource created
- `400 Bad Request` — Invalid request
- `401 Unauthorized` — Authentication required
- `403 Forbidden` — Insufficient permissions
- `404 Not Found` — Resource not found
- `500 Internal Server Error` — Server error
- `502 Bad Gateway` — External service error

---

## Authentication Headers

For authenticated endpoints, include:
```
X-User-Id: <userId>
Authorization: Bearer <token>  (if JWT is implemented)
```

Or authenticate via:
- Session cookies
- Login response tokens

---

## Rate Limiting

Currently not explicitly documented in routes. Check `server.js` and middleware for any rate limiting implementation.

---

## Notes

- **E2E Encryption:** DMs support end-to-end encryption using public/private key pairs
- **Feed Personalization:** Supports diversity, exploration, and scoring algorithms in `src/feed/`
- **Search:** Elasticsearch integration available in `elasticsearchService.js`
- **Media Handling:** Images and videos are compressed before storage (`compressUploads` middleware)
- **CORS:** Cross-origin requests handled via `cors` middleware
- **Admin Caching:** Some admin routes may cache data for performance

---

**Generated on:** May 28, 2026  
**For questions or updates:** Check the individual route files in `src/routes/` and controller files in `src/controllers/`


Live Streaming
Base Path: /api/live
WebSocket: /ws?userId=<id> (for real‑time signaling)
Authentication: requireAuth for all routes and WebSocket connections.

The live streaming feature allows users to broadcast video/audio in real time. Viewers can join a session, chat, send reactions, and see live viewer counts.

HTTP Endpoints
Get Active Sessions
text
GET /api/live/active
Authorization Required: Authenticated
Response: { success: true, data: [ { sessionId, title, viewerCount, startedAt, hostId, broadcasterName, broadcasterAvatar } ] }
Fetch all currently active live streams.

Get Session Details
text
GET /api/live/:sessionId
Authorization Required: Authenticated
Response: { sessionId, title, broadcasterName, broadcasterAvatar, hostId, viewerCount, startedAt }
Get details of a specific live session.

Start a Live Stream
text
POST /api/live/start
Authorization Required: Authenticated
Body: { title: "<stream_title>" }
Response: { sessionId, title, broadcasterName, broadcasterAvatar, hostId }
Initiates a new live session. The host must already have camera/mic permissions.

End a Live Stream
text
POST /api/live/end
Authorization Required: Authenticated
Body: { sessionId: "<session_id>" }
Response: { success: true }
Ends the live session and notifies all viewers via WebSocket.

WebSocket Signaling
All WebSocket messages are JSON objects with a type field. The connection URL is:

text
ws://your-domain/ws?userId=<user_id>
Authentication is performed via the userId query parameter.

Message Types
Type	Direction	Description
live:started	Server → All	Broadcast when a new stream starts. Payload: { type, sessionId, title, broadcasterName, broadcasterAvatar, hostId }
live:ended	Server → Viewers	Sent when a stream ends. Payload: { type, sessionId }
live:viewer_join	Client → Server	Viewer requests to join a session. Payload: { type, sessionId, viewerId, viewerName }
live:viewer_joined	Server → Host	Informs the host that a viewer joined. Payload: { type, sessionId, viewerId, viewerName, viewerCount }
live:viewer_left	Server → Host	Informs the host that a viewer left. Payload: { type, sessionId, viewerId, viewerCount }
live:viewer_count	Server → All	Broadcasts the current viewer count to everyone in the room. Payload: { type, sessionId, count }
live:offer	Client → Server → Target	WebRTC offer (SDP). Payload: { type, sessionId, offer, from, to }
live:answer	Client → Server → Target	WebRTC answer. Payload: { type, sessionId, answer, from, to }
live:ice_candidate	Client → Server → Target	ICE candidate. Payload: { type, sessionId, candidate, from, to }
live:chat_message	Client → Server → Room	Chat message. Payload: { type, sessionId, senderId, senderName, text }
live:reaction	Client → Server → Room	Reaction emoji. Payload: { type, sessionId, emoji, from }
Notes:

All signaling messages (offer, answer, ice_candidate) must include a to field with the target user ID for point‑to‑point routing.

The server automatically broadcasts viewer_count updates when viewers join or leave.

Chat and reaction messages are relayed to all participants in the room.

Client Integration
For detailed client‑side implementation, refer to:

LiveContext.jsx – React context managing state and WebSocket handlers.

LiveOverlay.jsx – UI overlay for active stream viewing/broadcasting.

LiveSetupModal.jsx – Camera/mic permission and stream setup.

Insert this section after "Link Preview" and before "Error Responses" or wherever you'd like. You can also adjust the ordering.

Let me know if you'd like any modifications.

