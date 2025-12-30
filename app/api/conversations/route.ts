import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getConversationList, 
  getConversation, 
  saveConversation, 
  deleteConversation 
} from '@/lib/chat-history';
import { 
  unauthorizedError, 
  notFoundError, 
  validationError, 
  handleApiError 
} from '@/lib/api-utils';

// Helper to verify user authorization
async function verifyAuth(requestUserId: string | null) {
  const { userId: authUserId } = await auth();
  if (!authUserId || authUserId !== requestUserId) {
    return { authorized: false, error: unauthorizedError() };
  }
  return { authorized: true, userId: authUserId };
}

// GET /api/conversations - Get list of conversations or a specific conversation
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');

    const authResult = await verifyAuth(userId);
    if (!authResult.authorized) return authResult.error;

    if (conversationId) {
      const messages = await getConversation(userId!, conversationId);
      if (!messages) {
        return notFoundError('Conversation');
      }
      return NextResponse.json({ messages });
    }

    const conversations = await getConversationList(userId!);
    return NextResponse.json({ conversations });
  } catch (error) {
    return handleApiError(error, 'Get conversations');
  }
}

// POST /api/conversations - Save a conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, conversationId, messages, title, mode } = body;

    const authResult = await verifyAuth(userId);
    if (!authResult.authorized) return authResult.error;

    if (!conversationId || !messages) {
      return validationError('conversationId and messages', 'Missing required fields');
    }

    const success = await saveConversation(userId, conversationId, messages, title, mode);
    
    if (!success) {
      return handleApiError(new Error('Save failed'), 'Save conversation');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Save conversation');
  }
}

// DELETE /api/conversations - Delete a conversation
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');

    const authResult = await verifyAuth(userId);
    if (!authResult.authorized) return authResult.error;

    if (!conversationId) {
      return validationError('conversationId', 'Missing conversation ID');
    }

    const success = await deleteConversation(userId!, conversationId);
    
    if (!success) {
      return handleApiError(new Error('Delete failed'), 'Delete conversation');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Delete conversation');
  }
}
