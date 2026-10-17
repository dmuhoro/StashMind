/**
 * OpenAPI 3.1 Specification for StashMind Public REST API (/api/v1)
 * Follows Part C (Integration Contract) Section 1.
 */

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'StashMind Public REST API',
    version: '1.0.0',
    description:
      'Headless learning engine API turning raw sources into dual-host audio lessons, grounded cards, conversational practice, and spaced repetition review.',
    contact: {
      name: 'StashMind Platform Team',
      url: 'https://stashmind.ai',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Primary StashMind API Server',
    },
  ],
  paths: {
    '/lessons': {
      post: {
        summary: 'Create a new audio lesson from text, URL, or YouTube',
        operationId: 'createLesson',
        security: [{ BearerAuth: ['lessons:write'] }],
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            schema: { type: 'string' },
            description: 'Unique client-generated key preventing duplicate generation',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  source_type: { type: 'string', enum: ['text', 'url', 'youtube', 'pdf'] },
                  content: { type: 'string', description: 'Raw source text, article URL, or YouTube link' },
                  title: { type: 'string' },
                  preset: { type: 'string', enum: ['student', 'learner', 'professional'] },
                  style: { type: 'string', enum: ['tldr', 'eli5', 'debate', 'deep_dive'] },
                  duration_minutes: { type: 'integer', enum: [5, 10, 20] },
                },
                required: ['source_type', 'content'],
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Lesson generation accepted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    lesson_id: { type: 'string' },
                    status: { type: 'string' },
                    estimated_seconds: { type: 'integer' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '429': { $ref: '#/components/responses/RateLimitResponse' },
        },
      },
      get: {
        summary: 'List user lessons with cursor pagination',
        operationId: 'listLessons',
        security: [{ BearerAuth: ['lessons:read'] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list of lessons',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/Lesson' } },
                    next_cursor: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/lessons/{id}': {
      get: {
        summary: 'Get lesson details, script, section markers, and audio',
        operationId: 'getLessonById',
        security: [{ BearerAuth: ['lessons:read'] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Complete lesson object with cards',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    lesson: { $ref: '#/components/schemas/Lesson' },
                    cards: { type: 'array', items: { $ref: '#/components/schemas/Card' } },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFoundResponse' },
        },
      },
    },
    '/cards': {
      get: {
        summary: 'List cards by lesson or filter',
        operationId: 'listCards',
        security: [{ BearerAuth: ['cards:read'] }],
        parameters: [
          { name: 'lesson_id', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'List of grounded insight cards',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cards: { type: 'array', items: { $ref: '#/components/schemas/Card' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/cards/{id}/save': {
      post: {
        summary: 'Save an insight card to personal library',
        operationId: 'saveCard',
        security: [{ BearerAuth: ['cards:write'] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Card saved successfully' },
        },
      },
      delete: {
        summary: 'Remove card from saved library',
        operationId: 'unsaveCard',
        security: [{ BearerAuth: ['cards:write'] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Card unsaved successfully' },
        },
      },
    },
    '/library/search': {
      get: {
        summary: 'Full-text search across cards and lesson summaries',
        operationId: 'searchLibrary',
        security: [{ BearerAuth: ['cards:read'] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Matching cards and lessons' },
        },
      },
    },
    '/practice': {
      post: {
        summary: 'Start roleplay practice session',
        operationId: 'startPractice',
        security: [{ BearerAuth: ['practice:write'] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scenario_id: { type: 'string' },
                  mode: { type: 'string', enum: ['text', 'voice'], default: 'text' },
                },
                required: ['scenario_id'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Practice session created' },
        },
      },
    },
    '/practice/{id}/turn': {
      post: {
        summary: 'Submit turn in practice session with <= 30 words feedback',
        operationId: 'submitPracticeTurn',
        security: [{ BearerAuth: ['practice:write'] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  user_input: { type: 'string' },
                },
                required: ['user_input'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Turn evaluated with coaching feedback' },
        },
      },
    },
    '/reviews/due': {
      get: {
        summary: 'Get spaced repetition flashcards due for review',
        operationId: 'getDueReviews',
        security: [{ BearerAuth: ['reviews:read'] }],
        responses: {
          '200': { description: 'Cards currently due' },
        },
      },
    },
    '/reviews/{card_id}/grade': {
      post: {
        summary: 'Grade a review item (again, hard, good, easy)',
        operationId: 'gradeReview',
        security: [{ BearerAuth: ['reviews:write'] }],
        parameters: [
          { name: 'card_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  grade: { type: 'string', enum: ['again', 'hard', 'good', 'easy'] },
                },
                required: ['grade'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Next review interval computed' },
        },
      },
    },
    '/export/deck/{id}': {
      get: {
        summary: 'Export lesson deck in Markdown, JSON, or CSV',
        operationId: 'exportDeck',
        security: [{ BearerAuth: ['export:read'] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['md', 'json', 'csv'], default: 'md' } },
        ],
        responses: {
          '200': { description: 'Formatted deck export file content' },
        },
      },
    },
    '/usage': {
      get: {
        summary: 'Get current quota and daily spend metrics',
        operationId: 'getUsage',
        security: [{ BearerAuth: ['lessons:read'] }],
        responses: {
          '200': { description: 'User tier, daily lesson usage, and TTS seconds used' },
        },
      },
    },
    '/me': {
      get: {
        summary: 'Get authenticated user profile and active audience preset',
        operationId: 'getProfile',
        security: [{ BearerAuth: ['lessons:read'] }],
        responses: {
          '200': { description: 'User profile object' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'StashMind Scoped API Key (format: stm_live_...)',
      },
    },
    schemas: {
      Lesson: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          audience_preset: { type: 'string' },
          style: { type: 'string' },
          target_duration_minutes: { type: 'integer' },
          status: { type: 'string' },
          audio_url: { type: 'string' },
          audio_duration_seconds: { type: 'integer' },
        },
      },
      Card: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          headline: { type: 'string' },
          insight: { type: 'string' },
          actionable_takeaway: { type: 'string' },
          source_section_pointer: { type: 'string' },
          audio_timestamp_seconds: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    responses: {
      ErrorResponse: {
        description: 'Standard error shape',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    request_id: { type: 'string' },
                  },
                  required: ['code', 'message', 'request_id'],
                },
              },
            },
          },
        },
      },
      NotFoundResponse: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'NOT_FOUND' },
                    message: { type: 'string' },
                    request_id: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      RateLimitResponse: {
        description: 'Daily cap or rate limit reached',
        headers: {
          'Retry-After': {
            schema: { type: 'integer' },
            description: 'Seconds until quota resets',
          },
        },
      },
    },
  },
} as const;
