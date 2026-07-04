import { pgTable, varchar, text, boolean, timestamp, integer, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import Redis from "ioredis";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: varchar("username").unique(),
  name: varchar("name"),
  email: varchar("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  bio: text("bio"),
  role: varchar("role").default("member"),
  isVerified: boolean("is_verified").default(false),
  isBanned: boolean("is_banned").default(false),
  bannedUntil: timestamp("banned_until"),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(),
  provider: varchar("provider").notNull(),
  providerAccountId: varchar("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: varchar("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [
  uniqueIndex("provider_provider_account_id_idx").on(table.provider, table.providerAccountId),
]);

export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier").notNull(),
  token: varchar("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

export const follows = pgTable("follows", {
  id: varchar("id").primaryKey(),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  followingId: varchar("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("follower_id_following_id_idx").on(table.followerId, table.followingId),
]);

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey(),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content"),
  visibility: varchar("visibility").default("public"),
  replyToPostId: varchar("reply_to_post_id"),
  repostOfPostId: varchar("repost_of_post_id"),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  repostCount: integer("repost_count").default(0),
  bookmarkCount: integer("bookmark_count").default(0),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const media = pgTable("media", {
  id: varchar("id").primaryKey(),
  postId: varchar("post_id").notNull().references(() => posts.id),
  type: varchar("type").notNull(),
  url: text("url").notNull(),
  publicId: varchar("public_id"),
  thumbnailUrl: text("thumbnail_url"),
  altText: text("alt_text"),
  width: integer("width"),
  height: integer("height"),
  duration: integer("duration"),
  bytes: integer("bytes"),
  format: varchar("format"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey(),
  postId: varchar("post_id").notNull().references(() => posts.id),
  authorId: varchar("author_id").notNull().references(() => users.id),
  parentCommentId: varchar("parent_comment_id"),
  content: text("content").notNull(),
  likeCount: integer("like_count").default(0),
  replyCount: integer("reply_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const likes = pgTable("likes", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  postId: varchar("post_id").notNull().references(() => posts.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("user_id_post_id_idx").on(table.userId, table.postId),
]);

export const bookmarks = pgTable("bookmarks", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  postId: varchar("post_id").notNull().references(() => posts.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("bookmark_user_id_post_id_idx").on(table.userId, table.postId),
]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  actorId: varchar("actor_id").notNull().references(() => users.id),
  type: varchar("type"),
  entityId: varchar("entity_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role").notNull(),
  amount: integer("amount").notNull(),
  status: varchar("status").default("pending"),
  plisioOrderId: varchar("plisio_order_id"),
  plisioTxnId: varchar("plisio_txn_id"),
  paymentMethod: varchar("payment_method").default("crypto"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adSlots = pgTable("ad_slots", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  title: varchar("title"),
  description: text("description"),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  status: varchar("status").default("pending_payment"),
  activeFrom: timestamp("active_from"),
  activeUntil: timestamp("active_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const postViews = pgTable("post_views", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: varchar("post_id").notNull().references(() => posts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("post_views_post_id_user_id_idx").on(table.postId, table.userId),
]);

export const news = pgTable("news", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customUsername: varchar("custom_username").notNull(),
  customRole: varchar("custom_role"),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const newsMedia = pgTable("news_media", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  newsId: varchar("news_id").notNull().references(() => news.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(),
  url: text("url").notNull(),
  publicId: varchar("public_id"),
  thumbnailUrl: text("thumbnail_url"),
  altText: text("alt_text"),
  width: integer("width"),
  height: integer("height"),
  duration: integer("duration"),
  bytes: integer("bytes"),
  format: varchar("format"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  likes: many(likes),
  bookmarks: many(bookmarks),
  followers: many(follows, { relationName: "following" }),
  following: many(follows, { relationName: "follower" }),
  transactions: many(transactions),
  adSlots: many(adSlots),
  postViews: many(postViews),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  media: many(media),
  comments: many(comments),
  likes: many(likes),
  bookmarks: many(bookmarks),
  views: many(postViews),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  post: one(posts, {
    fields: [media.postId],
    references: [posts.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parentComment: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: "replies"
  }),
  replies: many(comments, { relationName: "replies" }),
  likes: many(likes),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [likes.postId],
    references: [posts.id],
  }),
}));

export const adSlotsRelations = relations(adSlots, ({ one }) => ({
  user: one(users, {
    fields: [adSlots.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [adSlots.transactionId],
    references: [transactions.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [bookmarks.postId],
    references: [posts.id],
  }),
}));

export const postViewsRelations = relations(postViews, ({ one }) => ({
  user: one(users, {
    fields: [postViews.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [postViews.postId],
    references: [posts.id],
  }),
}));

export const newsRelations = relations(news, ({ many }) => ({
  media: many(newsMedia),
}));

export const newsMediaRelations = relations(newsMedia, ({ one }) => ({
  news: one(news, {
    fields: [newsMedia.newsId],
    references: [news.id],
  }),
}));

// Initialize Redis for development
export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
