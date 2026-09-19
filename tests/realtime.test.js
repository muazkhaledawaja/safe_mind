// Realtime tests run against local Supabase Realtime (supabase start), the
// actual protocol the frontend will use. REST stays the single write path:
// these tests write via the API and assert what Realtime delivers.
const { createClient } = require('@supabase/supabase-js');
const env = require('../src/config/env');
const request = require('supertest');
const app = require('../src/app');
const { registerAndLogin, createApprovedSpecialist } = require('./helpers');

// Every client created by the suite, so a failing test cannot leak an open
// websocket (which would otherwise keep jest running forever).
const liveClients = [];

function realtimeClient(token) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  client.realtime.setAuth(token);
  liveClients.push(client);
  return client;
}

// Resolves once the channel reaches SUBSCRIBED, rejects on transport errors.
function subscribe(channel, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      channel.unsubscribe();
      reject(new Error('channel subscribe timeout'));
    }, timeoutMs);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        channel.unsubscribe();
        reject(new Error(`channel ${status}`));
      }
    });
  });
}

// Watches one postgres_changes event on messages, filtered to a conversation.
// Returns { channel, ready, promise } - await ready before triggering the
// write, await promise to receive the matching row.
function watchMessage(client, conversationId, event, matcher) {
  const channel = client.channel(`watch:${conversationId}:${event}`);
  const timer = setTimeout(() => {
    channel.unsubscribe();
  }, 12000);
  // postgres_changes listeners must be attached before subscribe().
  const promise = new Promise((resolve, reject) => {
    channel.on(
      'postgres_changes',
      { event, schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        if (matcher(payload)) {
          clearTimeout(timer);
          resolve(payload.new);
        }
      }
    );
  });
  const ready = subscribe(channel).catch((err) => {
    clearTimeout(timer);
    throw err;
  });
  return { channel, ready, promise };
}

// A broadcast listener on a named channel (used for typing).
function watchBroadcast(client, channelName, event) {
  const channel = client.channel(channelName);
  let timer;
  const promise = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout waiting for broadcast:${event}`)), 12000);
    channel.on('broadcast', { event }, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
  const ready = subscribe(channel);
  return { channel, ready, promise };
}

// Counts every row RLS allows this client to see on messages. Await ready
// first, then read .arrived after settling.
function realtimeCounter(client, label) {
  const state = { arrived: 0, channel: null };
  const channel = client
    .channel(`count:${label}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      state.arrived += 1;
    });
  state.channel = channel;
  return { state, ready: subscribe(channel) };
}

async function waitForPresenceState(channel, userId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const present = Object.values(channel.presenceState()).some((presences) =>
      presences.some((p) => p.userId === userId)
    );
    if (present) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`presence of user ${userId} never observed`);
}

// Closes every realtime channel and the underlying socket so jest can exit.
function teardownRealtime(...clients) {
  for (const client of clients) {
    if (!client) continue;
    client.removeAllChannels();
    if (client.realtime && typeof client.realtime.disconnect === 'function') {
      client.realtime.disconnect();
    }
  }
}

// User books with an approved specialist, the specialist accepts, and we
// return { userToken, specialistToken, conversationId, userId }.
async function makeConversation() {
  const userToken = await registerAndLogin('chatuser@example.com');
  const spec = await createApprovedSpecialist('chat-spec@example.com');

  const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${userToken}`);
  const userId = me.body.data.id;

  const booking = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ specialistId: spec.specialistId, scheduledAt: new Date(Date.now() + 86400000).toISOString(), durationMin: 30 });
  expect(booking.status).toBe(201);

  const respond = await request(app)
    .patch(`/api/v1/appointments/${booking.body.data.id}/respond`)
    .set('Authorization', `Bearer ${spec.token}`)
    .send({ decision: 'accepted' });
  expect(respond.status).toBe(200);

  const convs = await request(app).get('/api/v1/conversations').set('Authorization', `Bearer ${userToken}`);
  const conversationId = convs.body.data[0].id;
  return { userToken, specialistToken: spec.token, conversationId, userId };
}

describe('realtime messages via Supabase', () => {
  afterEach(() => {
    while (liveClients.length) teardownRealtime(liveClients.pop());
  });

  test('a message sent through REST is delivered to the other participant', async () => {
    const { userToken, specialistToken, conversationId } = await makeConversation();

    const specialistClient = realtimeClient(specialistToken);
    const watch = watchMessage(specialistClient, conversationId, 'INSERT', () => true);
    await watch.ready;

    const sent = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'مرحبا من الاختبار' });
    expect(sent.status).toBe(201);

    const row = await watch.promise;
    expect(row.body).toBe('مرحبا من الاختبار');
    expect(row.conversation_id).toBe(conversationId);

    teardownRealtime(specialistClient);
  });

  test('marking a message read pushes the read state once', async () => {
    const { userToken, specialistToken, conversationId } = await makeConversation();

    const sent = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'read me' });
    const messageId = sent.body.data.id;

    const userClient = realtimeClient(userToken);
    const updates = watchMessage(userClient, conversationId, 'UPDATE', () => true);
    await updates.ready;

    const read = await request(app)
      .patch(`/api/v1/messages/${messageId}/read`)
      .set('Authorization', `Bearer ${specialistToken}`);
    expect(read.status).toBe(200);
    expect(read.body.data.isRead).toBe(true);

    const row = await updates.promise;
    expect(row.id).toBe(messageId);
    expect(row.is_read).toBe(true);

    // A second mark-read updates nothing, so no further UPDATE is streamed.
    updates.channel.unsubscribe();
    const counter = realtimeCounter(userClient, 'second-read');
    await counter.ready;

    await request(app).patch(`/api/v1/messages/${messageId}/read`).set('Authorization', `Bearer ${specialistToken}`);
    await new Promise((r) => setTimeout(r, 1200));
    expect(counter.state.arrived).toBe(0);

    teardownRealtime(userClient);
  });

  test('a third party receives nothing even with a valid token (RLS gate)', async () => {
    const { userToken, specialistToken, conversationId } = await makeConversation();
    const outsiderToken = await registerAndLogin('outsider@example.com');

    const outsiderClient = realtimeClient(outsiderToken);
    const outsiderCounter = realtimeCounter(outsiderClient, 'outsider');
    await outsiderCounter.ready;

    const specialistClient = realtimeClient(specialistToken);
    const participant = watchMessage(specialistClient, conversationId, 'INSERT', () => true);
    await participant.ready;

    await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'private' });

    await participant.promise;
    await new Promise((r) => setTimeout(r, 1200));
    expect(outsiderCounter.state.arrived).toBe(0);

    teardownRealtime(outsiderClient, specialistClient);
  });

  test('typing is relayed as a broadcast between participants', async () => {
    const { userToken, specialistToken, conversationId, userId } = await makeConversation();

    const userClient = realtimeClient(userToken);
    const specialistClient = realtimeClient(specialistToken);

    const userChannel = userClient.channel(`typing:${conversationId}`);
    const watcher = watchBroadcast(specialistClient, `typing:${conversationId}`, 'typing');
    await Promise.all([subscribe(userChannel), watcher.ready]);

    await userChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { conversationId, userId, isTyping: true },
    });

    const received = await watcher.promise;
    expect(received.payload.isTyping).toBe(true);
    expect(received.payload.userId).toBe(userId);

    teardownRealtime(userClient, specialistClient);
  });

  test('presence shows a participant who joined the conversation channel', async () => {
    const { userToken, specialistToken, conversationId, userId } = await makeConversation();

    const userClient = realtimeClient(userToken);
    const specialistClient = realtimeClient(specialistToken);

    const specialistChannel = specialistClient.channel(`presence:${conversationId}`);
    const userChannel = userClient.channel(`presence:${conversationId}`);
    // Registering a presence listener before subscribe is required: without it
    // the channel's internal tracker never accumulates presence state.
    specialistChannel.on('presence', { event: 'sync' }, () => {});
    userChannel.on('presence', { event: 'sync' }, () => {});
    await Promise.all([subscribe(userChannel), subscribe(specialistChannel)]);
    await userChannel.track({ userId });
    await waitForPresenceState(specialistChannel, userId);

    teardownRealtime(userClient, specialistClient);
  });
});