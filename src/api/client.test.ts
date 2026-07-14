import { ApiError, api } from './client';

describe('API client', () => {
  const fetchMock = jest.fn();

  beforeAll(() => {
    global.fetch = fetchMock as typeof fetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('adds the bearer token when reading messages', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [], next_cursor: null }),
    });

    await api.getMessages('access-token');

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer access-token');
  });

  it('keeps the client id in a turn request for idempotent retry', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', reply: '我在', no_reply: false, metadata: {} }),
    });

    await api.sendTurn('token', '慢慢说', 'client_0001');

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(options.body as string)).toEqual({
      text: '慢慢说',
      client_message_id: 'client_0001',
    });
  });

  it('maps a server error to an actionable message', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'turn_in_progress' }),
    });

    await expect(api.sendTurn('token', '你好', 'client_0002')).rejects.toMatchObject<
      Partial<ApiError>
    >({
      status: 409,
      code: 'turn_in_progress',
      message: '朝夕还在回复上一条消息，请稍等',
    });
  });
});
