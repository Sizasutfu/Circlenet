import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Post, User } from '../app/context/FeedContext';

const { width: screenWidth } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onQuote?: (postId: string) => void;
  onFollowToggle?: (userId: string) => void;
  isFollowing?: boolean;
  showFollowButton?: boolean;
}

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  else if (minutes < 60) return `${minutes}m ago`;
  else if (hours < 24) return `${hours}h ago`;
  else if (days < 7) return `${days}d ago`;
  else if (weeks < 4) return `${weeks}w ago`;
  else if (months < 12) return `${months}mo ago`;
  else return `${years}y ago`;
}

export default function PostCard({
  post,
  onLike,
  onComment,
  onRepost,
  onShare,
  onQuote,
  onFollowToggle,
  isFollowing = false,
  showFollowButton = false,
}: PostCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const {
    id,
    text,
    image,
    video,
    createdAt,
    user,
    likes = [],
    commentCount = 0,
    repostCount = 0,
    shares = 0,
    isLive = false,
    liked = false,
  } = post;

  const displayName = user?.name || 'Anonymous';
  const username = user?.username || '';
  const avatarUrl = user?.picture || null;
  const isVerified = user?.verified || false;
  const relativeTime = createdAt ? timeAgo(createdAt) : '';

  const likeCount = likes?.length || 0;
  const isLiked = liked || false;

  const handleLike = () => {
    if (onLike) onLike(id);
  };

  const handleComment = () => {
    if (onComment) onComment(id);
  };

  const handleRepost = () => {
    if (onRepost) onRepost(id);
  };

  const handleShare = () => {
    if (onShare) onShare(id);
  };

  const handleQuote = () => {
    if (onQuote) onQuote(id);
  };

  const goToPost = () => {
    // @ts-ignore - Expo Router handles this
    router.push(`/post/${id}`);
  };

  const goToProfile = () => {
    if (username) {
      // @ts-ignore - Expo Router handles this
      router.push(`/profile/${username}`);
    }
  };

  const shouldTruncate = text?.length > 200 && !isExpanded;
  const displayText = shouldTruncate ? text.slice(0, 200) + '…' : text;

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={goToPost}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToProfile} style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
        </TouchableOpacity>
        
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <TouchableOpacity onPress={goToProfile}>
              <Text style={styles.name}>{displayName}</Text>
            </TouchableOpacity>
            {isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#007AFF" />
            )}
            {showFollowButton && onFollowToggle && (
              <TouchableOpacity
                onPress={() => onFollowToggle(user?.id || '')}
                style={[styles.followButton, isFollowing && styles.followingButton]}
              >
                <Text style={[styles.followText, isFollowing && styles.followingText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.metaRow}>
            {username && <Text style={styles.username}>@{username}</Text>}
            <Text style={styles.time}>· {relativeTime}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Text style={styles.content}>
        {displayText}
      </Text>
      {text?.length > 200 && (
        <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
          <Text style={styles.showMore}>
            {isExpanded ? 'Show less' : 'Show more'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Image */}
      {image && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: image }}
            style={styles.image}
            resizeMode="cover"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
          />
          {imageLoading && (
            <View style={styles.imageLoader}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          )}
        </View>
      )}

      {/* Video placeholder */}
      {video && (
        <View style={styles.videoContainer}>
          <View style={styles.videoPlaceholder}>
            <Ionicons name="play-circle" size={48} color="#fff" />
            <Text style={styles.videoText}>Video</Text>
          </View>
        </View>
      )}

      {/* Live indicator */}
      {isLive && (
        <View style={styles.liveContainer}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons 
            name={isLiked ? 'heart' : 'heart-outline'} 
            size={22} 
            color={isLiked ? '#ff3b30' : '#666'} 
          />
          <Text style={[styles.actionText, isLiked && styles.actionTextLiked]}>
            {likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
          <Ionicons name="chatbubble-outline" size={22} color="#666" />
          <Text style={styles.actionText}>{commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleRepost}>
          <Ionicons name="repeat-outline" size={22} color="#666" />
          <Text style={styles.actionText}>{repostCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleQuote}>
          <Ionicons name="chatbox-outline" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color="#666" />
          <Text style={styles.actionText}>{shares || 0}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e5e5',
  },
  headerText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  username: {
    fontSize: 13,
    color: '#666',
  },
  time: {
    fontSize: 13,
    color: '#999',
  },
  followButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 6,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  followText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  followingText: {
    color: '#666',
  },
  moreButton: {
    padding: 4,
  },
  content: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 20,
    marginBottom: 4,
  },
  showMore: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  imageContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: screenWidth - 32,
    height: (screenWidth - 32) * 0.6,
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  videoContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    width: screenWidth - 32,
    height: (screenWidth - 32) * 0.6,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
  },
  liveContainer: {
    marginTop: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#666',
  },
  actionTextLiked: {
    color: '#ff3b30',
  },
});