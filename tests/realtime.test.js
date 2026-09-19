jest.mock('../src/config/mailer', () => require('./__mocks__/mailer'));

const http = require('http');
const { io: Client } = require('socket.io-client');
const request = require('supertest');
const app = require('../src/app');
const initSockets = require('../src/sockets');
const { query } = require('../src/config/db');
const { registerAndLogin, createApprovedSpecialist } = require('./helpers');

let io;
let port;
let openSockets = [];

beforeAll(async () => {
  const server = http.createServer(app);
  io = initSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

afterEach(() => {
  openSockets.forEach((socket) => socket.disconnect());
  openSockets = [];
});

afterAll(async () => {
  // io.close() also closes the underlying HTTP server and engine.io timers.
  await new Promise((resolve) => io.close(resolve));
});

async function acceptedConversation() {
  const { token: specToken, specialistId } = await createApprovedSpecialist();
  const userToken = await registerAndLogin('chatuser@example.com');
  const specUserId = (await query('SELECT user_id FROM specialists WHERE id = ?', [specialistId]))[0].user_id;
  const bookRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ specialistId, scheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() });
  await request(app)
    .patch(`/api/v1/appointments/${bookRes.body.data.id}/respond`)
    .set('Authorization', `Bearer ${specToken}`)
    .send({ decision: 'accepted' });
  const conversations = await request(app)
    .get('/api/v1/conversations')
    .set('Authorization', `Bearer ${userToken}`);
  return { userToken, specToken, conversationId: conversations.body.data[0].id, specUserId };
}

// Resolves on the server's `ready` event (rooms joined), not on `connect`,
// which fires before the server has finished joining rooms.
function connect(token) {
  const socket = Client(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  openSockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('ready', () => resolve(socket));
    socket.on('connect_error', (err) => {
      socket.disconnect();
      reject(err);
    });
  });
}

function once(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function assertNotReceived(socket, event, settleMs = 600) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, settleMs);
    socket.on(event, function handler() {
      clearTimeout(timer);
      socket.off(event, handler);
      reject(new Error(`Unexpectedly received ${event}`));
    });
  });
}

function waitForPresence(socket, userId, isOnline, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('presence:update', handler);
      reject(new Error(`No presence:update for user ${userId}`));
    }, timeoutMs);
    const handler = (payload) => {
      if (payload.userId === userId && payload.online === isOnline) {
        clearTimeout(timer);
        socket.off('presence:update', handler);
        resolve(payload);
      }
    };
    socket.on('presence:update', handler);
  });
}

describe('socket auth', () => {
  test('a connection without a valid JWT is rejected with UNAUTHORIZED', async () => {
    await expect(connect('not-a-jwt')).rejects.toHaveProperty('data.code', 'UNAUTHORIZED');
  });

  test('a valid JWT connects and becomes ready', async () => {
    const token = await registerAndLogin('socketauth@example.com');
    const socket = await connect(token);
    expect(socket.connected).toBe(true);
  });
});

describe('presence', () => {
  test('a participant sees the other party come online and go offline', async () => {
    const { userToken, specToken, conversationId, specUserId } = await acceptedConversation();

    const userSocket = await connect(userToken);
    const onlinePromise = waitForPresence(userSocket, specUserId, true);
    const specSocket = await connect(specToken);

    const online = await onlinePromise;
    expect(online).toMatchObject({ conversationId, userId: specUserId, online: true });

    const offlinePromise = waitForPresence(userSocket, specUserId, false);
    specSocket.disconnect();
    const offline = await offlinePromise;
    expect(offline).toMatchObject({ conversationId, userId: specUserId, online: false });
  });
});

describe('conversation rooms', () => {
  test('a third party cannot join a conversation room', async () => {
    const { userToken, specToken, conversationId } = await acceptedConversation();
    const outsiderToken = await registerAndLogin('outsider@example.com');

    const specSocket = await connect(specToken);
    const outsiderSocket = await connect(outsiderToken);
    await connect(userToken);

    const errorPromise = once(outsiderSocket, 'conversation:error');
    outsiderSocket.emit('conversation:join', { conversationId });
    const error = await errorPromise;
    expect(error.code).toBe('FORBIDDEN');

    const sentPromise = once(specSocket, 'message:new');
    await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'hello outsider' });

    const sent = await sentPromise;
    expect(sent.body).toBe('hello outsider');
    await assertNotReceived(outsiderSocket, 'message:new');
  });
});

describe('realtime messages', () => {
  test('a sent message is delivered to the other participant in realtime', async () => {
    const { userToken, specToken, conversationId } = await acceptedConversation();

    const specSocket = await connect(specToken);
    await connect(userToken);

    const promise = once(specSocket, 'message:new');
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'Are you free tomorrow?' });
    expect(res.status).toBe(201);

    const message = await promise;
    expect(message.id).toBe(res.body.data.id);
    expect(message.body).toBe('Are you free tomorrow?');
    expect(message.conversationId).toBe(conversationId);
  });

  test('marking a message read pushes a read receipt once', async () => {
    const { userToken, specToken, conversationId } = await acceptedConversation();

    const userSocket = await connect(userToken);
    const specSocket = await connect(specToken);

    const newPromise = once(specSocket, 'message:new');
    const sentRes = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'Read me' });
    await newPromise;

    const receipt = once(userSocket, 'message:read');
    await request(app)
      .patch(`/api/v1/messages/${sentRes.body.data.id}/read`)
      .set('Authorization', `Bearer ${specToken}`);

    const readReceipt = await receipt;
    expect(readReceipt.id).toBe(sentRes.body.data.id);
    expect(readReceipt.isRead).toBe(true);

    // A repeat mark-read is a no-op and must not re-announce.
    const repeat = assertNotReceived(userSocket, 'message:read');
    await request(app)
      .patch(`/api/v1/messages/${sentRes.body.data.id}/read`)
      .set('Authorization', `Bearer ${specToken}`);
    await repeat;
  });
});

describe('typing indicators', () => {
  test('typing on and off reach the other participant but not the sender', async () => {
    const { userToken, specToken, conversationId } = await acceptedConversation();

    const userSocket = await connect(userToken);
    const specSocket = await connect(specToken);

    const startedPromise = once(specSocket, 'typing:update');
    userSocket.emit('typing:set', { conversationId, isTyping: true });
    expect(await startedPromise).toMatchObject({ conversationId, isTyping: true });

    const stoppedPromise = once(specSocket, 'typing:update');
    userSocket.emit('typing:set', { conversationId, isTyping: false });
    expect(await stoppedPromise).toMatchObject({ conversationId, isTyping: false });

    await assertNotReceived(userSocket, 'typing:update');
  });

  test('typing in a conversation the socket has not joined is ignored', async () => {
    const { userToken, specToken, conversationId } = await acceptedConversation();
    const outsiderToken = await registerAndLogin('typist@example.com');

    const specSocket = await connect(specToken);
    await connect(userToken);
    const outsiderSocket = await connect(outsiderToken);

    outsiderSocket.emit('typing:set', { conversationId, isTyping: true });
    await assertNotReceived(specSocket, 'typing:update');
  });
});
