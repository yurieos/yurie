import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getConversationList, 
  getConversation, 
  saveConversation, 
  deleteConversation 
} from '@/lib/chat-history';

// GET /api/conversations - Get list of conversations or a specific conversation
export async function GET(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');

    // Verify the user is authenticated and requesting their own data
    if (!authUserId || authUserId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (conversationId) {
      // Get specific conversation
      const messages = await getConversation(userId, conversationId);
      if (!messages) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ messages });
    } else {
      // Get list of conversations
      const conversations = await getConversationList(userId);
      return NextResponse.json({ conversations });
    }
  } catch (error) {
    console.error('Failed to get conversations:', error);
    return NextResponse.json(
      { error: 'Failed to get conversations' },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Save a conversation
export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    const body = await request.json();
    const { userId, conversationId, messages, title } = body;

    // Verify the user is authenticated and saving their own data
    if (!authUserId || authUserId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!conversationId || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const success = await saveConversation(userId, conversationId, messages, title);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save conversation:', error);
    return NextResponse.json(
      { error: 'Failed to save conversation' },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations - Delete a conversation
export async function DELETE(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');

    // Verify the user is authenticated and deleting their own data
    if (!authUserId || authUserId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversation ID' },
        { status: 400 }
      );
    }

    const success = await deleteConversation(userId, conversationId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}

