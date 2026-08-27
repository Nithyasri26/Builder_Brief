import type { ChatMessage, Conversation } from '@/types/chat';
import type { CitizenNotification } from '@/types/notification';
import type { CitizenDocument, DigiLockerDocument } from '@/types/document';
import { demoDocuments, demoDigiLockerDocuments } from '@/data/demo/documents';
import { DEMO_USER_ID } from '@/data/demo/citizen';

export interface SeedBundle {
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  documents: CitizenDocument[];
  digiLocker: DigiLockerDocument[];
  notifications: CitizenNotification[];
}

function iso(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * A small amount of history so the sidebar and notification list look like a
 * product that has been used before. Every seeded conversation contains real
 * messages, so reopening one restores genuine context.
 */
export function buildSeed(): SeedBundle {
  const marksheetConversationId = 'conv-seed-marksheet';
  const welcomeConversationId = 'conv-seed-welcome';

  const conversations: Conversation[] = [
    {
      id: marksheetConversationId,
      userId: DEMO_USER_ID,
      title: '10th Marksheet',
      createdAt: iso(1, 16, 5),
      updatedAt: iso(1, 16, 8),
      preview: 'Your 10th marksheet is saved with your papers.',
    },
    {
      id: welcomeConversationId,
      userId: DEMO_USER_ID,
      title: 'Getting started',
      createdAt: iso(2, 11, 20),
      updatedAt: iso(2, 11, 22),
      preview: 'Ask for anything in your own words.',
    },
  ];

  const messages: Record<string, ChatMessage[]> = {
    [marksheetConversationId]: [
      {
        id: 'msg-seed-1',
        conversationId: marksheetConversationId,
        role: 'user',
        content: 'Do I have my 10th marksheet?',
        createdAt: iso(1, 16, 5),
      },
      {
        id: 'msg-seed-2',
        conversationId: marksheetConversationId,
        role: 'assistant',
        content: 'Yes, you have your 10th marksheet. You will not need to find it again.',
        createdAt: iso(1, 16, 8),
        blocks: [
          {
            type: 'notice',
            tone: 'info',
            body: 'This is a practice app, so your real DigiLocker account is never opened.',
          },
        ],
        suggestions: ['Show my papers', 'What else can you help me with?'],
        meta: { intent: 'GET_DOCUMENT', confidence: 0.94, aiSource: 'rules' },
      },
    ],
    [welcomeConversationId]: [
      {
        id: 'msg-seed-3',
        conversationId: welcomeConversationId,
        role: 'user',
        content: 'What can you do?',
        createdAt: iso(2, 11, 20),
      },
      {
        id: 'msg-seed-4',
        conversationId: welcomeConversationId,
        role: 'assistant',
        content:
          'Tell me what you need in your own words. I can look for government help, show your PF money, apply for a passport, write a complaint, find your papers, or look up a train.',
        createdAt: iso(2, 11, 22),
        suggestions: ['Is there any government help for me?', 'Show my PF money', 'Show my papers'],
        meta: { intent: 'HELP', confidence: 0.99, aiSource: 'rules' },
      },
    ],
  };

  const notifications: CitizenNotification[] = [
    {
      id: 'notif-seed-1',
      userId: DEMO_USER_ID,
      title: 'Your papers are ready',
      body: 'Your papers are saved here, so services can use them without asking you again.',
      tone: 'info',
      createdAt: iso(1, 16, 9),
      read: false,
      actionPrompt: 'Show my documents',
      actionLabel: 'View documents',
    },
    {
      id: 'notif-seed-2',
      userId: DEMO_USER_ID,
      title: 'Welcome to NammaSahaay',
      body: 'Just tell me what you need in your own words.',
      tone: 'info',
      createdAt: iso(2, 11, 18),
      read: true,
    },
  ];

  return {
    conversations,
    messages,
    documents: demoDocuments.map((doc) => ({ ...doc })),
    digiLocker: demoDigiLockerDocuments.map((doc) => ({ ...doc })),
    notifications,
  };
}
