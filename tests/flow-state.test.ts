import { vi } from 'vitest';

vi.hoisted(() => {
  process.env.OPENAI_API_KEY = 'mock-openai-key';
});

import { describe, it, expect } from 'vitest';

vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [] }),
      },
    },
    embeddings: {
      create: vi.fn().mockResolvedValue({ data: [] }),
    },
  }));
  return {
    default: MockOpenAI,
    OpenAI: MockOpenAI,
  };
});

import { FlowService } from '@/server/src/services/flow.service';

describe('Chatbot Flow Engine', () => {
  const mockTenantId = 'tenant-123';

  it('should match keyword flow correctly when trigger keyword is in the message', async () => {
    // Mock Supabase select for chatbot_flows
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'flow-pricing-123',
                    definition: [
                      {
                        triggerType: 'keyword',
                        triggerKeyword: 'pricing',
                      },
                    ],
                  },
                  {
                    id: 'flow-hours-456',
                    definition: [
                      {
                        triggerType: 'keyword',
                        triggerKeyword: 'hours',
                      },
                    ],
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as any;

    const matchedFlow = await FlowService.matchKeywordFlow(mockDb, mockTenantId, 'What is your pricing options?');
    expect(matchedFlow).toBe('flow-pricing-123');

    const matchedFlow2 = await FlowService.matchKeywordFlow(mockDb, mockTenantId, 'Are you open during holidays?');
    expect(matchedFlow2).toBeNull();
  });

  it('should match first_message welcome flow correctly', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'welcome-flow-789',
                      definition: [
                        {
                          triggerType: 'first_message',
                        },
                      ],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    } as any;

    const welcomeFlow = await FlowService.findWelcomeFlow(mockDb, mockTenantId);
    expect(welcomeFlow).toBe('welcome-flow-789');
  });
});
