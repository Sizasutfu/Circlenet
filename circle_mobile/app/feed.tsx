import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FeedProvider, useFeed, Post } from './context/FeedContext';
import PostCard from '../components/PostCard';

function FeedContent() {
  const router = useRouter();
  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    activeTab,
    error,
    setActiveTab,
    fetchPosts,
    loadMore,
    toggleLike,
    addPost,
  } = useFeed();

  const [composerText, setComposerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!loading && posts.length === 0) {
      fetchPosts(activeTab, 1, false);
    }
  }, [activeTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts(activeTab, 1, false);
    setRefreshing(false);
  }, [activeTab, fetchPosts]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      loadMore();
    }
  };

  const handleCreatePost = async () => {
    if (!composerText.trim()) return;
    setIsSubmitting(true);
    try {
      const newPost: Post = {
        id: `post_${Date.now()}`,
        text: composerText.trim(),
        image: null,
        video: null,
        createdAt: new Date().toISOString(),
        user: {
          id: 'current_user',
          name: 'You',
          username: '@you',
          picture: 'https://i.pravatar.cc/150?img=5',
        },
        likes: [],
        commentCount: 0,
        repostCount: 0,
        recentComments: [],
        liked: false,
      };
      addPost(newPost);
      setComposerText('');
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No posts yet</Text>
      <Text style={styles.emptySubtext}>Be the first to share something!</Text>
    </View>
  );

  const renderHeader = () => (
    <>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab('global')}
          style={[styles.tab, activeTab === 'global' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.tabTextActive]}>
            Global
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('following')}
          style={[styles.tab, activeTab === 'following' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
            Following
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('articles')}
          style={[styles.tab, activeTab === 'articles' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'articles' && styles.tabTextActive]}>
            Articles
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.composerContainer}>
        <View style={styles.composerInputContainer}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/150?img=5' }}
            style={styles.composerAvatar}
          />
          <TextInput
            style={styles.composerInput}
            placeholder="What's on your mind?"
            placeholderTextColor="#999"
            value={composerText}
            onChangeText={setComposerText}
            multiline
          />
        </View>
        <TouchableOpacity
          style={[
            styles.composerButton,
            (!composerText.trim() || isSubmitting) && styles.composerButtonDisabled,
          ]}
          onPress={handleCreatePost}
          disabled={!composerText.trim() || isSubmitting}
        >
          <Text style={styles.composerButtonText}>
            {isSubmitting ? 'Posting...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchPosts(activeTab, 1, false)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onLike={toggleLike}
          onComment={() => {
            router.push(`/post/${item.id}` as any);
          }}
          onRepost={() => {}}
          onShare={() => {}}
          onQuote={() => {}}
        />
      )}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyState}
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      showsVerticalScrollIndicator={false}
    />
  );
}

export default function Feed() {
  return (
    <FeedProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Feed</Text>
          <TouchableOpacity onPress={() => console.log('Profile')}>
            <Ionicons name="person-circle-outline" size={32} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
        <FeedContent />
      </SafeAreaView>
    </FeedProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  composerContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginBottom: 4,
  },
  composerInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  composerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  composerInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 40,
  },
  composerButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  composerButtonDisabled: {
    opacity: 0.5,
  },
  composerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});