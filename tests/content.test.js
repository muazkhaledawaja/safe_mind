jest.mock('../src/config/mailer', () => require('./__mocks__/mailer'));

const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');

async function adminToken(email = 'admin@example.com') {
  await request(app).post('/api/v1/auth/register').send({ nickname: 'Admin', email, password: 'password1' });
  await query('UPDATE users SET role = ? WHERE email = ?', ['admin', email]);
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'password1' });
  return res.body.data.token;
}

async function createCategory(token, overrides = {}) {
  const res = await request(app)
    .post('/api/v1/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ nameAr: 'القلق', nameEn: 'Anxiety', ...overrides });
  return res.body.data;
}

describe('categories', () => {
  test('public can list, cannot write', async () => {
    const list = await request(app).get('/api/v1/categories');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);

    const write = await request(app).post('/api/v1/categories').send({ nameAr: 'a', nameEn: 'b' });
    expect(write.status).toBe(401);
  });

  test('admin can create, non-admin cannot', async () => {
    const admin = await adminToken();
    const created = await createCategory(admin);
    expect(created.slug).toBe('anxiety');

    await request(app).post('/api/v1/auth/register').send({
      nickname: 'User',
      email: 'user@example.com',
      password: 'password1',
    });
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'password1' });

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${userLogin.body.data.token}`)
      .send({ nameAr: 'a', nameEn: 'b' });
    expect(res.status).toBe(403);
  });

  test('cannot delete a category that still has articles', async () => {
    const admin = await adminToken();
    const category = await createCategory(admin);
    await request(app)
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${admin}`)
      .send({ categoryId: category.id, title: 'Test', content: 'Body', status: 'published' });

    const res = await request(app)
      .delete(`/api/v1/categories/${category.id}`)
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_IN_USE');
  });
});

describe('articles', () => {
  test('drafts are invisible to the public but visible to admin', async () => {
    const admin = await adminToken();
    const category = await createCategory(admin);
    await request(app)
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${admin}`)
      .send({ categoryId: category.id, title: 'Draft One', content: 'Body' });

    const publicList = await request(app).get('/api/v1/articles');
    expect(publicList.body.data).toHaveLength(0);

    const adminList = await request(app).get('/api/v1/articles/admin').set('Authorization', `Bearer ${admin}`);
    expect(adminList.body.data).toHaveLength(1);
  });

  test('non-admin cannot list drafts', async () => {
    await request(app).post('/api/v1/auth/register').send({
      nickname: 'User',
      email: 'user@example.com',
      password: 'password1',
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'password1' });

    const res = await request(app)
      .get('/api/v1/articles/admin')
      .set('Authorization', `Bearer ${login.body.data.token}`);
    expect(res.status).toBe(403);
  });

  test('published article is publicly readable by slug and increments views', async () => {
    const admin = await adminToken();
    const category = await createCategory(admin);
    const createRes = await request(app)
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${admin}`)
      .send({ categoryId: category.id, title: 'Managing Anxiety', content: 'Body text', status: 'published' });

    const slug = createRes.body.data.slug;
    expect(slug).toBe('managing-anxiety');

    const first = await request(app).get(`/api/v1/articles/${slug}`);
    expect(first.status).toBe(200);
    expect(first.body.data.viewsCount).toBe(1);

    const second = await request(app).get(`/api/v1/articles/${slug}`);
    expect(second.body.data.viewsCount).toBe(2);
  });

  test('a draft article 404s on the public slug endpoint', async () => {
    const admin = await adminToken();
    const category = await createCategory(admin);
    const createRes = await request(app)
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${admin}`)
      .send({ categoryId: category.id, title: 'Still a Draft', content: 'Body' });

    const res = await request(app).get(`/api/v1/articles/${createRes.body.data.slug}`);
    expect(res.status).toBe(404);
  });

  test('Arabic search term returns relevant published articles', async () => {
    const admin = await adminToken();
    const category = await createCategory(admin);
    await request(app)
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        categoryId: category.id,
        title: 'التعامل مع القلق',
        content: 'مقال عن كيفية التعامل مع القلق اليومي',
        status: 'published',
      });
    await request(app)
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        categoryId: category.id,
        title: 'النوم الصحي',
        content: 'مقال عن أهمية النوم',
        status: 'published',
      });

    const res = await request(app).get('/api/v1/articles').query({ search: 'القلق' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((a) => a.title.includes('القلق'))).toBe(true);
  });

  test('filtering by category slug only returns that category articles', async () => {
    const admin = await adminToken();
    const categoryA = await createCategory(admin, { nameEn: 'Anxiety', nameAr: 'قلق' });
    const categoryB = await createCategory(admin, { nameEn: 'Sleep', nameAr: 'نوم' });

    await request(app)
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${admin}`)
      .send({ categoryId: categoryA.id, title: 'A1', content: 'Body', status: 'published' });
    await request(app)
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${admin}`)
      .send({ categoryId: categoryB.id, title: 'B1', content: 'Body', status: 'published' });

    const res = await request(app).get('/api/v1/articles').query({ category: 'sleep' });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('B1');
  });

  test('pagination meta reflects total and defaults', async () => {
    const admin = await adminToken();
    const category = await createCategory(admin);
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/articles')
        .set('Authorization', `Bearer ${admin}`)
        .send({ categoryId: category.id, title: `Article ${i}`, content: 'Body', status: 'published' });
    }

    const res = await request(app).get('/api/v1/articles').query({ limit: 2 });
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3 });
  });
});
