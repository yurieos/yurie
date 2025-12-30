import { Redis } from '@upstash/redis'
import { loggers } from './utils/logger';

const log = loggers.core;


// Initialize Redis client from environment variables
// Uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
const getRedis = () => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return Redis.fromEnv()
}

// Types for chat history
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  searchResults?: string // Store search results for context
  // Rich UI persistence fields
  type?: 'text' | 'search-display' | 'markdown' | 'error'
  sources?: Array<{ url: string; title: string; content?: string; quality?: number; summary?: string }>
  followUpQuestions?: string[]
  // Full searchEvents for Progress UI (excluding content-chunk for size)
  searchEvents?: Array<{
    type: string
    [key: string]: unknown
  }>
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  mode?: 'default' | 'visual'
}

// Save or update a conversation
export async function saveConversation(
  userId: string,
  conversationId: string,
  messages: ChatMessage[],
  title?: string,
  mode?: 'default' | 'visual'
): Promise<boolean> {
  const redis = getRedis()
  if (!redis) {
    log.debug('Redis not configured, chat history will not be saved')
    return false
  }

  try {
    // Store the messages
    const messageKey = `chat:${userId}:${conversationId}:messages`
    await redis.set(messageKey, JSON.stringify(messages))

    // Create or update conversation metadata
    const conversation: Conversation = {
      id: conversationId,
      title: title || messages[0]?.content?.slice(0, 60) || 'New Chat',
      createdAt: messages[0]?.timestamp || Date.now(),
      updatedAt: Date.now(),
      messageCount: messages.length,
      mode: mode || 'default',
    }

    // Store in sorted set for ordering by update time
    const listKey = `user:${userId}:conversations`
    
    // Remove old entry if exists (to update the score)
    const existingList = await redis.zrange(listKey, 0, -1)
    for (const item of existingList) {
      const parsed = typeof item === 'string' ? JSON.parse(item) : item
      if (parsed.id === conversationId) {
        await redis.zrem(listKey, JSON.stringify(parsed))
        break
      }
    }

    // Add with new score (timestamp for ordering)
    await redis.zadd(listKey, {
      score: Date.now(),
      member: JSON.stringify(conversation),
    })

    return true
  } catch (error) {
    log.debug('Failed to save conversation:', error)
    return false
  }
}

// Get list of conversations for a user (most recent first)
export async function getConversationList(
  userId: string,
  limit: number = 50
): Promise<Conversation[]> {
  const redis = getRedis()
  if (!redis) {
    return []
  }

  try {
    const listKey = `user:${userId}:conversations`
    const conversations = await redis.zrange(listKey, 0, limit - 1, { rev: true })
    
    return conversations.map((item) => {
      if (typeof item === 'string') {
        return JSON.parse(item) as Conversation
      }
      return item as Conversation
    })
  } catch (error) {
    log.debug('Failed to get conversation list:', error)
    return []
  }
}

// Load a specific conversation's messages
export async function getConversation(
  userId: string,
  conversationId: string
): Promise<ChatMessage[] | null> {
  const redis = getRedis()
  if (!redis) {
    return null
  }

  try {
    const messageKey = `chat:${userId}:${conversationId}:messages`
    const data = await redis.get(messageKey)
    
    if (!data) {
      return null
    }

    if (typeof data === 'string') {
      return JSON.parse(data) as ChatMessage[]
    }
    
    return data as ChatMessage[]
  } catch (error) {
    log.debug('Failed to get conversation:', error)
    return null
  }
}

// Delete a conversation
export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const redis = getRedis()
  if (!redis) {
    return false
  }

  try {
    // Delete messages
    const messageKey = `chat:${userId}:${conversationId}:messages`
    await redis.del(messageKey)

    // Remove from conversation list
    const listKey = `user:${userId}:conversations`
    const conversations = await redis.zrange(listKey, 0, -1)
    
    for (const item of conversations) {
      const parsed = typeof item === 'string' ? JSON.parse(item) : item
      if (parsed.id === conversationId) {
        await redis.zrem(listKey, JSON.stringify(parsed))
        break
      }
    }

    return true
  } catch (error) {
    log.debug('Failed to delete conversation:', error)
    return false
  }
}

// Update conversation title
export async function updateConversationTitle(
  userId: string,
  conversationId: string,
  newTitle: string
): Promise<boolean> {
  const redis = getRedis()
  if (!redis) {
    return false
  }

  try {
    const listKey = `user:${userId}:conversations`
    const conversations = await redis.zrange(listKey, 0, -1, { withScores: true })
    
    for (let i = 0; i < conversations.length; i += 2) {
      const item = conversations[i]
      const score = conversations[i + 1] as number
      const parsed = typeof item === 'string' ? JSON.parse(item as string) : item
      
      if (parsed.id === conversationId) {
        // Remove old entry
        await redis.zrem(listKey, JSON.stringify(parsed))
        
        // Add updated entry with same score
        parsed.title = newTitle
        await redis.zadd(listKey, {
          score: score,
          member: JSON.stringify(parsed),
        })
        
        return true
      }
    }

    return false
  } catch (error) {
    log.debug('Failed to update conversation title:', error)
    return false
  }
}

// Clear all conversations for a user
export async function clearAllConversations(userId: string): Promise<boolean> {
  const redis = getRedis()
  if (!redis) {
    return false
  }

  try {
    // Get all conversation IDs
    const conversations = await getConversationList(userId, 1000)
    
    // Delete each conversation's messages
    for (const conv of conversations) {
      const messageKey = `chat:${userId}:${conv.id}:messages`
      await redis.del(messageKey)
    }

    // Clear the conversation list
    const listKey = `user:${userId}:conversations`
    await redis.del(listKey)

    return true
  } catch (error) {
    log.debug('Failed to clear all conversations:', error)
    return false
  }
}

