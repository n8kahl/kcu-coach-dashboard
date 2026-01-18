// ============================================
// KCU Social Builder - Influencer Scraper
// ============================================

import { createClient } from '@supabase/supabase-js';
import {
  InfluencerProfile,
  InfluencerPost,
  ScrapedPostData,
  SocialPlatform,
  ScrapeResult,
} from '@/types/social';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Instagram Scraper
// ============================================

interface InstagramProfileData {
  id: string;
  username: string;
  full_name: string;
  biography: string;
  profile_pic_url: string;
  followers_count: number;
  following_count: number;
  media_count: number;
  is_business_account: boolean;
}

interface InstagramMediaData {
  id: string;
  shortcode: string;
  display_url: string;
  video_url?: string;
  is_video: boolean;
  caption?: string;
  likes_count: number;
  comments_count: number;
  video_view_count?: number;
  taken_at_timestamp: number;
  product_type?: string; // 'feed', 'igtv', 'reels', 'clips'
}

/**
 * Scrape Instagram profile using RapidAPI or similar service
 * Falls back to public data if API unavailable
 */
export async function scrapeInstagramProfile(
  handle: string
): Promise<Partial<InfluencerProfile> | null> {
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    console.warn('RAPIDAPI_KEY not configured, using mock data');
    return getMockInstagramProfile(handle);
  }

  try {
    // Using RapidAPI Instagram scraper
    const response = await fetch(
      `https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=${encodeURIComponent(handle)}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      console.error(`Instagram API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const user = data.data;

    return {
      platform: 'instagram' as SocialPlatform,
      platform_user_id: user.id,
      handle: user.username,
      display_name: user.full_name,
      bio: user.biography,
      profile_url: `https://instagram.com/${user.username}`,
      profile_image_url: user.profile_pic_url_hd || user.profile_pic_url,
      followers_count: user.follower_count,
      following_count: user.following_count,
      posts_count: user.media_count,
    };
  } catch (error) {
    console.error('Error scraping Instagram profile:', error);
    return null;
  }
}

/**
 * Scrape recent Instagram posts
 */
export async function scrapeInstagramPosts(
  handle: string,
  limit: number = 20
): Promise<ScrapedPostData[]> {
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    console.warn('RAPIDAPI_KEY not configured, using mock data');
    return getMockInstagramPosts(handle, limit);
  }

  try {
    const response = await fetch(
      `https://instagram-scraper-api2.p.rapidapi.com/v1.2/posts?username_or_id_or_url=${encodeURIComponent(handle)}&count=${limit}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      console.error(`Instagram posts API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const posts = data.data?.items || [];

    return posts.map((post: any) => ({
      platform_post_id: post.id,
      platform_url: `https://instagram.com/p/${post.code}`,
      content_type: mapInstagramContentType(post.media_type, post.product_type),
      caption: post.caption?.text || '',
      hashtags: extractHashtags(post.caption?.text || ''),
      mentions: extractMentions(post.caption?.text || ''),
      media_type: post.media_type === 2 ? 'video' : post.media_type === 8 ? 'carousel' : 'image',
      media_url: post.image_versions2?.candidates?.[0]?.url || post.thumbnail_url,
      thumbnail_url: post.thumbnail_url,
      video_duration_seconds: post.video_duration,
      likes_count: post.like_count || 0,
      comments_count: post.comment_count || 0,
      shares_count: post.share_count || 0,
      saves_count: post.save_count || 0,
      views_count: post.play_count || post.view_count || 0,
      posted_at: new Date(post.taken_at * 1000).toISOString(),
    }));
  } catch (error) {
    console.error('Error scraping Instagram posts:', error);
    return [];
  }
}

function mapInstagramContentType(mediaType: number, productType?: string): string {
  if (productType === 'reels' || productType === 'clips') return 'reel';
  if (mediaType === 2) return 'video';
  if (mediaType === 8) return 'carousel';
  return 'feed_post';
}

// ============================================
// TikTok Scraper
// ============================================

/**
 * Scrape TikTok profile using tikapi.io or similar
 */
export async function scrapeTikTokProfile(
  handle: string
): Promise<Partial<InfluencerProfile> | null> {
  const apiKey = process.env.TIKAPI_KEY;

  if (!apiKey) {
    console.warn('TIKAPI_KEY not configured, using mock data');
    return getMockTikTokProfile(handle);
  }

  try {
    const response = await fetch(
      `https://api.tikapi.io/public/check?username=${encodeURIComponent(handle)}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error(`TikTok API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const user = data.userInfo?.user;
    const stats = data.userInfo?.stats;

    if (!user) return null;

    return {
      platform: 'tiktok' as SocialPlatform,
      platform_user_id: user.id,
      handle: user.uniqueId,
      display_name: user.nickname,
      bio: user.signature,
      profile_url: `https://tiktok.com/@${user.uniqueId}`,
      profile_image_url: user.avatarLarger || user.avatarMedium,
      followers_count: stats?.followerCount || 0,
      following_count: stats?.followingCount || 0,
      posts_count: stats?.videoCount || 0,
    };
  } catch (error) {
    console.error('Error scraping TikTok profile:', error);
    return null;
  }
}

/**
 * Scrape recent TikTok videos
 */
export async function scrapeTikTokPosts(
  handle: string,
  limit: number = 20
): Promise<ScrapedPostData[]> {
  const apiKey = process.env.TIKAPI_KEY;

  if (!apiKey) {
    console.warn('TIKAPI_KEY not configured, using mock data');
    return getMockTikTokPosts(handle, limit);
  }

  try {
    const response = await fetch(
      `https://api.tikapi.io/public/posts?username=${encodeURIComponent(handle)}&count=${limit}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error(`TikTok posts API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const videos = data.itemList || [];

    return videos.map((video: any) => ({
      platform_post_id: video.id,
      platform_url: `https://tiktok.com/@${handle}/video/${video.id}`,
      content_type: 'video',
      caption: video.desc || '',
      hashtags: extractHashtags(video.desc || ''),
      mentions: extractMentions(video.desc || ''),
      media_type: 'video',
      media_url: video.video?.playAddr,
      thumbnail_url: video.video?.cover,
      video_duration_seconds: video.video?.duration,
      likes_count: video.stats?.diggCount || 0,
      comments_count: video.stats?.commentCount || 0,
      shares_count: video.stats?.shareCount || 0,
      saves_count: video.stats?.collectCount || 0,
      views_count: video.stats?.playCount || 0,
      posted_at: new Date(video.createTime * 1000).toISOString(),
    }));
  } catch (error) {
    console.error('Error scraping TikTok posts:', error);
    return [];
  }
}

// ============================================
// YouTube Scraper
// ============================================

/**
 * Scrape YouTube channel using YouTube Data API
 */
export async function scrapeYouTubeChannel(
  channelId: string
): Promise<Partial<InfluencerProfile> | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not configured, using mock data');
    return getMockYouTubeProfile(channelId);
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
    );

    if (!response.ok) {
      console.error(`YouTube API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const channel = data.items?.[0];

    if (!channel) return null;

    return {
      platform: 'youtube' as SocialPlatform,
      platform_user_id: channel.id,
      handle: channel.snippet?.customUrl?.replace('@', '') || channel.id,
      display_name: channel.snippet?.title,
      bio: channel.snippet?.description,
      profile_url: `https://youtube.com/${channel.snippet?.customUrl || `channel/${channel.id}`}`,
      profile_image_url: channel.snippet?.thumbnails?.high?.url,
      followers_count: parseInt(channel.statistics?.subscriberCount || '0'),
      posts_count: parseInt(channel.statistics?.videoCount || '0'),
    };
  } catch (error) {
    console.error('Error scraping YouTube channel:', error);
    return null;
  }
}

/**
 * Scrape recent YouTube videos
 */
export async function scrapeYouTubePosts(
  channelId: string,
  limit: number = 20
): Promise<ScrapedPostData[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not configured, using mock data');
    return getMockYouTubePosts(channelId, limit);
  }

  try {
    // First get upload playlist
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    );

    const channelData = await channelResponse.json();
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) return [];

    // Get videos from uploads playlist
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${limit}&key=${apiKey}`
    );

    const videosData = await videosResponse.json();
    const videoIds = videosData.items?.map((item: any) => item.contentDetails.videoId).join(',');

    // Get video statistics
    const statsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${apiKey}`
    );

    const statsData = await statsResponse.json();
    const statsMap = new Map(statsData.items?.map((item: any) => [item.id, item]));

    return videosData.items?.map((item: any) => {
      const videoId = item.contentDetails.videoId;
      const stats = statsMap.get(videoId) as any;
      const duration = stats?.contentDetails?.duration;
      const isShort = parseDuration(duration) <= 60;

      return {
        platform_post_id: videoId,
        platform_url: `https://youtube.com/watch?v=${videoId}`,
        content_type: isShort ? 'short' : 'video',
        caption: item.snippet?.title + '\n\n' + (item.snippet?.description || ''),
        hashtags: extractHashtags(item.snippet?.description || ''),
        mentions: [],
        media_type: 'video',
        thumbnail_url: item.snippet?.thumbnails?.high?.url,
        video_duration_seconds: parseDuration(duration),
        likes_count: parseInt(stats?.statistics?.likeCount || '0'),
        comments_count: parseInt(stats?.statistics?.commentCount || '0'),
        shares_count: 0,
        saves_count: 0,
        views_count: parseInt(stats?.statistics?.viewCount || '0'),
        posted_at: item.snippet?.publishedAt,
      };
    }) || [];
  } catch (error) {
    console.error('Error scraping YouTube videos:', error);
    return [];
  }
}

// Parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}

// ============================================
// Unified Scraper Interface
// ============================================

/**
 * Scrape influencer profile by platform
 */
export async function scrapeInfluencerProfile(
  platform: SocialPlatform,
  handle: string
): Promise<Partial<InfluencerProfile> | null> {
  switch (platform) {
    case 'instagram':
      return scrapeInstagramProfile(handle);
    case 'tiktok':
      return scrapeTikTokProfile(handle);
    case 'youtube':
      return scrapeYouTubeChannel(handle);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Scrape influencer posts by platform
 */
export async function scrapeInfluencerPosts(
  platform: SocialPlatform,
  handle: string,
  limit: number = 20
): Promise<ScrapedPostData[]> {
  switch (platform) {
    case 'instagram':
      return scrapeInstagramPosts(handle, limit);
    case 'tiktok':
      return scrapeTikTokPosts(handle, limit);
    case 'youtube':
      return scrapeYouTubePosts(handle, limit);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Full scrape of an influencer - profile and posts
 */
export async function scrapeInfluencer(
  influencerId: string
): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    success: false,
    influencer_id: influencerId,
    posts_scraped: 0,
    new_posts: 0,
    updated_posts: 0,
    errors: [],
  };

  try {
    // Get influencer from database
    const { data: influencer, error: influencerError } = await supabase
      .from('influencer_profiles')
      .select('*')
      .eq('id', influencerId)
      .single();

    if (influencerError || !influencer) {
      result.errors?.push('Influencer not found');
      return result;
    }

    // Scrape profile updates
    const profileData = await scrapeInfluencerProfile(
      influencer.platform,
      influencer.handle
    );

    if (profileData) {
      // Update profile in database
      await supabase
        .from('influencer_profiles')
        .update({
          ...profileData,
          last_scraped_at: new Date().toISOString(),
        })
        .eq('id', influencerId);
    }

    // Scrape posts
    const scrapingSettings = await getScrapeSettings();
    const postsData = await scrapeInfluencerPosts(
      influencer.platform,
      influencer.handle,
      scrapingSettings.default_posts_per_scrape
    );

    result.posts_scraped = postsData.length;

    // Calculate engagement rates and save posts
    const followerCount = profileData?.followers_count || influencer.followers_count || 1;

    for (const postData of postsData) {
      const engagementRate = calculateEngagementRate(
        postData.likes_count,
        postData.comments_count,
        postData.shares_count,
        followerCount
      );

      const postToSave = {
        influencer_id: influencerId,
        ...postData,
        engagement_rate: engagementRate,
        scraped_at: new Date().toISOString(),
      };

      // Upsert post
      const { error: postError } = await supabase
        .from('influencer_posts')
        .upsert(postToSave, {
          onConflict: 'influencer_id,platform_post_id',
        });

      if (postError) {
        result.errors?.push(`Error saving post ${postData.platform_post_id}: ${postError.message}`);
      } else {
        result.new_posts++;
      }
    }

    // Update average metrics on influencer profile
    if (postsData.length > 0) {
      const avgLikes = postsData.reduce((sum, p) => sum + p.likes_count, 0) / postsData.length;
      const avgComments = postsData.reduce((sum, p) => sum + p.comments_count, 0) / postsData.length;
      const avgEngagement = calculateEngagementRate(avgLikes, avgComments, 0, followerCount);

      await supabase
        .from('influencer_profiles')
        .update({
          avg_likes: Math.round(avgLikes),
          avg_comments: Math.round(avgComments),
          engagement_rate: avgEngagement,
        })
        .eq('id', influencerId);
    }

    result.success = true;
    return result;
  } catch (error) {
    result.errors?.push(`Scrape error: ${error}`);
    return result;
  }
}

/**
 * Scrape all active influencers that are due for scraping
 */
export async function scrapeAllDueInfluencers(): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  // Get influencers due for scraping
  const { data: influencers, error } = await supabase
    .from('influencer_profiles')
    .select('id, last_scraped_at, scrape_frequency_hours')
    .eq('is_active', true);

  if (error || !influencers) {
    console.error('Error fetching influencers:', error);
    return results;
  }

  const now = new Date();

  for (const influencer of influencers) {
    const lastScraped = influencer.last_scraped_at
      ? new Date(influencer.last_scraped_at)
      : new Date(0);
    const hoursSinceLastScrape = (now.getTime() - lastScraped.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastScrape >= influencer.scrape_frequency_hours) {
      const result = await scrapeInfluencer(influencer.id);
      results.push(result);

      // Rate limit between scrapes
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return results;
}

// ============================================
// Helper Functions
// ============================================

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u0080-\uFFFF]+/g) || [];
  return matches.map((h) => h.toLowerCase());
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w.]+/g) || [];
  return matches.map((m) => m.toLowerCase());
}

function calculateEngagementRate(
  likes: number,
  comments: number,
  shares: number,
  followers: number
): number {
  if (followers === 0) return 0;
  // Weighted engagement: comments count 2x, shares count 3x
  const engagement = likes + comments * 2 + shares * 3;
  return Math.round((engagement / followers) * 10000) / 100; // Returns percentage with 2 decimals
}

async function getScrapeSettings() {
  const { data } = await supabase
    .from('social_builder_config')
    .select('config_value')
    .eq('config_key', 'scraping_settings')
    .single();

  return (
    data?.config_value || {
      default_posts_per_scrape: 20,
      scrape_interval_hours: 24,
      max_influencers_per_platform: 50,
      analyze_tone_on_scrape: true,
    }
  );
}

// ============================================
// Mock Data (for development without API keys)
// ============================================

function getMockInstagramProfile(handle: string): Partial<InfluencerProfile> {
  return {
    platform: 'instagram',
    handle,
    display_name: `${handle} (Mock)`,
    bio: 'Day trader | LTP Framework | Trading education',
    profile_url: `https://instagram.com/${handle}`,
    profile_image_url: 'https://via.placeholder.com/150',
    followers_count: Math.floor(Math.random() * 100000) + 10000,
    following_count: Math.floor(Math.random() * 1000) + 100,
    posts_count: Math.floor(Math.random() * 500) + 50,
  };
}

function getMockInstagramPosts(handle: string, limit: number): ScrapedPostData[] {
  const posts: ScrapedPostData[] = [];
  const captions = [
    'The LTP setup was beautiful today 📈 Level ✅ Trend ✅ Patience ✅ #daytrading #stocks',
    'Stop revenge trading. Trust your process. The market will be there tomorrow. #tradingpsychology',
    'Pre-market analysis: SPY looking weak at resistance. Watching for short setup 👀 #premarket',
    'Another green day using the framework. Discipline > luck every time 💪 #tradingwins',
    'CPI data coming in hot. Here is how I am positioning... #economicdata #trading',
  ];

  for (let i = 0; i < Math.min(limit, 20); i++) {
    const likes = Math.floor(Math.random() * 5000) + 100;
    const comments = Math.floor(Math.random() * 200) + 10;

    posts.push({
      platform_post_id: `mock_ig_${handle}_${i}`,
      platform_url: `https://instagram.com/p/mock${i}`,
      content_type: Math.random() > 0.3 ? 'feed_post' : 'reel',
      caption: captions[i % captions.length],
      hashtags: extractHashtags(captions[i % captions.length]),
      mentions: [],
      media_type: Math.random() > 0.5 ? 'image' : 'video',
      thumbnail_url: 'https://via.placeholder.com/400',
      likes_count: likes,
      comments_count: comments,
      shares_count: Math.floor(Math.random() * 50),
      saves_count: Math.floor(Math.random() * 100),
      views_count: Math.random() > 0.5 ? Math.floor(Math.random() * 50000) : 0,
      posted_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return posts;
}

function getMockTikTokProfile(handle: string): Partial<InfluencerProfile> {
  return {
    platform: 'tiktok',
    handle,
    display_name: `${handle} (Mock)`,
    bio: 'Trading tips | Market analysis | Education',
    profile_url: `https://tiktok.com/@${handle}`,
    profile_image_url: 'https://via.placeholder.com/150',
    followers_count: Math.floor(Math.random() * 500000) + 50000,
    following_count: Math.floor(Math.random() * 500) + 50,
    posts_count: Math.floor(Math.random() * 300) + 30,
  };
}

function getMockTikTokPosts(handle: string, limit: number): ScrapedPostData[] {
  const posts: ScrapedPostData[] = [];
  const captions = [
    'POV: You finally understand support and resistance 📈 #daytrading #stockmarket #tradertok',
    'The ONE thing that changed my trading forever... #tradingadvice #stocktok',
    'Reacting to my worst trade ever 💀 #tradingfails #learningmoment',
    'Why 90% of traders fail (harsh truth) #tradingpsychology #realtalk',
    'Morning routine of a full-time trader ☀️ #dayinmylife #trader',
  ];

  for (let i = 0; i < Math.min(limit, 20); i++) {
    const views = Math.floor(Math.random() * 100000) + 5000;
    const likes = Math.floor(views * (Math.random() * 0.1 + 0.02));

    posts.push({
      platform_post_id: `mock_tt_${handle}_${i}`,
      platform_url: `https://tiktok.com/@${handle}/video/mock${i}`,
      content_type: 'video',
      caption: captions[i % captions.length],
      hashtags: extractHashtags(captions[i % captions.length]),
      mentions: [],
      media_type: 'video',
      thumbnail_url: 'https://via.placeholder.com/400x700',
      video_duration_seconds: Math.floor(Math.random() * 60) + 15,
      likes_count: likes,
      comments_count: Math.floor(likes * 0.02),
      shares_count: Math.floor(likes * 0.01),
      saves_count: Math.floor(likes * 0.03),
      views_count: views,
      posted_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return posts;
}

function getMockYouTubeProfile(channelId: string): Partial<InfluencerProfile> {
  return {
    platform: 'youtube',
    handle: channelId,
    display_name: `Channel ${channelId} (Mock)`,
    bio: 'Trading education and market analysis',
    profile_url: `https://youtube.com/channel/${channelId}`,
    profile_image_url: 'https://via.placeholder.com/150',
    followers_count: Math.floor(Math.random() * 200000) + 20000,
    posts_count: Math.floor(Math.random() * 200) + 20,
  };
}

function getMockYouTubePosts(channelId: string, limit: number): ScrapedPostData[] {
  const posts: ScrapedPostData[] = [];
  const titles = [
    'How I Made $5000 In One Trade Using LTP Framework',
    'The ONLY Trading Strategy You Need In 2024',
    'Why Most Traders Lose Money (And How To Fix It)',
    'Live Trading Session - Scalping SPY Options',
    'Beginner Trading Mistakes I Wish I Knew Earlier',
  ];

  for (let i = 0; i < Math.min(limit, 20); i++) {
    const views = Math.floor(Math.random() * 50000) + 1000;
    const isShort = Math.random() > 0.7;

    posts.push({
      platform_post_id: `mock_yt_${channelId}_${i}`,
      platform_url: `https://youtube.com/watch?v=mock${i}`,
      content_type: isShort ? 'short' : 'video',
      caption: titles[i % titles.length] + '\n\n#daytrading #stockmarket #tradingstrategy',
      hashtags: ['#daytrading', '#stockmarket', '#tradingstrategy'],
      mentions: [],
      media_type: 'video',
      thumbnail_url: 'https://via.placeholder.com/1280x720',
      video_duration_seconds: isShort ? Math.floor(Math.random() * 60) : Math.floor(Math.random() * 1200) + 300,
      likes_count: Math.floor(views * (Math.random() * 0.05 + 0.02)),
      comments_count: Math.floor(views * 0.01),
      shares_count: 0,
      saves_count: 0,
      views_count: views,
      posted_at: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return posts;
}
